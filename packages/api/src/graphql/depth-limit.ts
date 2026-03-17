import { GraphQLError, Kind, validate } from 'graphql';
import type {
  ASTVisitor,
  DocumentNode,
  SelectionSetNode,
  ValidationContext,
} from 'graphql';

export const DEFAULT_MAX_DEPTH = 10;

export function createDepthLimitRule(
  maxDepth: number,
): (context: ValidationContext) => ASTVisitor {
  return function depthLimitRule(context: ValidationContext): ASTVisitor {
    return {
      Document: {
        enter(node) {
          for (const definition of node.definitions) {
            if (definition.kind === Kind.OPERATION_DEFINITION) {
              checkDepth(
                context,
                definition.selectionSet,
                0,
                maxDepth,
                new Set(),
              );
            }
          }
        },
      },
    };
  };
}

export function makeDepthLimitPlugin(
  maxDepth: number,
): GraphileConfig.Plugin {
  const rule = createDepthLimitRule(maxDepth);
  return {
    name: 'DepthLimitPlugin',
    version: '1.0.0',
    grafast: {
      middleware: {
        parseAndValidate(next, event) {
          const result = next();
          if (Array.isArray(result)) {
            return result;
          }
          const document = result as DocumentNode;
          const errors = validate(event.schema, document, [rule]);
          if (errors.length > 0) {
            return errors;
          }
          return document;
        },
      },
    },
  };
}

function checkDepth(
  context: ValidationContext,
  selectionSet: SelectionSetNode | undefined,
  currentDepth: number,
  maxDepth: number,
  visitedFragments: Set<string>,
): void {
  if (!selectionSet) return;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const fieldDepth = currentDepth + 1;
      if (fieldDepth > maxDepth) {
        context.reportError(
          new GraphQLError(
            `Query depth ${fieldDepth} exceeds maximum allowed depth of ${maxDepth}`,
          ),
        );
        return;
      }
      if (selection.selectionSet) {
        checkDepth(
          context,
          selection.selectionSet,
          fieldDepth,
          maxDepth,
          visitedFragments,
        );
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      checkDepth(
        context,
        selection.selectionSet,
        currentDepth,
        maxDepth,
        visitedFragments,
      );
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const name = selection.name.value;
      if (!visitedFragments.has(name)) {
        visitedFragments.add(name);
        const fragment = context.getFragment(name);
        if (fragment) {
          checkDepth(
            context,
            fragment.selectionSet,
            currentDepth,
            maxDepth,
            visitedFragments,
          );
        }
      }
    }
  }
}
