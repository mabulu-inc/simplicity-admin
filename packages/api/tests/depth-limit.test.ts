import { describe, it, expect } from 'vitest';
import { parse, buildSchema, validate } from 'graphql';
import {
  createDepthLimitRule,
  makeDepthLimitPlugin,
  DEFAULT_MAX_DEPTH,
} from '../src/graphql/depth-limit.js';

const schema = buildSchema(`
  type Query {
    user: User
  }
  type User {
    name: String
    posts: [Post]
  }
  type Post {
    title: String
    author: User
    comments: [Comment]
  }
  type Comment {
    body: String
    author: User
    post: Post
  }
`);

describe('createDepthLimitRule', () => {
  it('default depth limit is 10', () => {
    expect(DEFAULT_MAX_DEPTH).toBe(10);
  });

  it('allows a query within the depth limit', () => {
    const doc = parse(`{
      user {
        name
        posts {
          title
        }
      }
    }`);
    const rule = createDepthLimitRule(10);
    const errors = validate(schema, doc, [rule]);
    expect(errors).toHaveLength(0);
  });

  it('rejects a query exceeding the depth limit', () => {
    // Build a deeply nested query (depth 5)
    const doc = parse(`{
      user {
        posts {
          author {
            posts {
              title
            }
          }
        }
      }
    }`);
    const rule = createDepthLimitRule(3);
    const errors = validate(schema, doc, [rule]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('depth');
  });

  it('allows a query at exactly the depth limit', () => {
    // depth 3: user -> posts -> title
    const doc = parse(`{
      user {
        posts {
          title
        }
      }
    }`);
    const rule = createDepthLimitRule(3);
    const errors = validate(schema, doc, [rule]);
    expect(errors).toHaveLength(0);
  });

  it('rejects a query one level beyond the limit', () => {
    // depth 4: user -> posts -> author -> name
    const doc = parse(`{
      user {
        posts {
          author {
            name
          }
        }
      }
    }`);
    const rule = createDepthLimitRule(3);
    const errors = validate(schema, doc, [rule]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles fragments correctly', () => {
    const doc = parse(`
      fragment UserFields on User {
        posts {
          author {
            posts {
              title
            }
          }
        }
      }
      {
        user {
          ...UserFields
        }
      }
    `);
    const rule = createDepthLimitRule(3);
    const errors = validate(schema, doc, [rule]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles inline fragments correctly', () => {
    const doc = parse(`{
      user {
        ... on User {
          posts {
            author {
              posts {
                title
              }
            }
          }
        }
      }
    }`);
    const rule = createDepthLimitRule(3);
    const errors = validate(schema, doc, [rule]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('makeDepthLimitPlugin', () => {
  it('creates a valid Graphile Config plugin', () => {
    const plugin = makeDepthLimitPlugin(10);
    expect(plugin.name).toBe('DepthLimitPlugin');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.grafast).toBeDefined();
    expect(plugin.grafast!.middleware).toBeDefined();
  });
});
