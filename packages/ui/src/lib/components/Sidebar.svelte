<script lang="ts">
  import type { NavItem } from '$lib/nav/types.js';

  interface SidebarProps {
    items: NavItem[];
    currentPath: string;
  }

  let { items, currentPath }: SidebarProps = $props();

  let grouped = $derived(() => {
    const groups = new Map<string, NavItem[]>();
    const ungrouped: NavItem[] = [];
    for (const item of items) {
      if (item.group) {
        if (!groups.has(item.group)) groups.set(item.group, []);
        groups.get(item.group)!.push(item);
      } else {
        ungrouped.push(item);
      }
    }
    return { groups, ungrouped };
  });
</script>

<nav data-testid="sidebar">
  {#if grouped().ungrouped.length > 0}
    <ul>
      {#each grouped().ungrouped as item}
        <li>
          <a href={item.href} class={currentPath === item.href ? 'active' : ''}>
            {#if item.icon}<span>{item.icon}</span>{/if}
            {item.label}
            {#if item.badge != null}<span>{item.badge}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  {#each [...grouped().groups.entries()] as [group, groupItems]}
    <div>
      <h3>{group}</h3>
      <ul>
        {#each groupItems as item}
          <li>
            <a href={item.href} class={currentPath === item.href ? 'active' : ''}>
              {#if item.icon}<span>{item.icon}</span>{/if}
              {item.label}
              {#if item.badge != null}<span>{item.badge}</span>{/if}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</nav>
