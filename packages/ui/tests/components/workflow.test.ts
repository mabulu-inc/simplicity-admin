import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import StateBadge from '../../src/lib/components/workflow/StateBadge.svelte';
import TransitionButtons from '../../src/lib/components/workflow/TransitionButtons.svelte';
import type { StateDefinition, Transition } from '@simplicity-admin/core';

afterEach(() => cleanup());

// ── StateBadge ──────────────────────────────────────────────────────

describe('StateBadge', () => {
  const states: StateDefinition[] = [
    { name: 'draft', label: 'Draft', color: 'gray' },
    { name: 'review', label: 'In Review', color: 'yellow' },
    { name: 'approved', label: 'Approved', color: 'green' },
    { name: 'archived', label: 'Archived', color: 'red', isFinal: true },
  ];

  it('renders with correct label for current state', () => {
    render(StateBadge, {
      props: { states, currentState: 'review' },
    });

    expect(screen.getByText('In Review')).toBeTruthy();
  });

  it('renders with correct color class', () => {
    render(StateBadge, {
      props: { states, currentState: 'approved' },
    });

    const badge = screen.getByTestId('state-badge');
    expect(badge.classList.contains('badge-green')).toBe(true);
  });

  it('renders with default color when state has no color', () => {
    const statesNoColor: StateDefinition[] = [
      { name: 'open', label: 'Open' },
    ];

    render(StateBadge, {
      props: { states: statesNoColor, currentState: 'open' },
    });

    const badge = screen.getByTestId('state-badge');
    expect(badge.classList.contains('badge-gray')).toBe(true);
  });

  it('shows state name as fallback when state not in definitions', () => {
    render(StateBadge, {
      props: { states, currentState: 'unknown' },
    });

    expect(screen.getByText('unknown')).toBeTruthy();
  });
});

// ── TransitionButtons ───────────────────────────────────────────────

describe('TransitionButtons', () => {
  const transitions: Transition[] = [
    { from: 'draft', to: 'review', label: 'Submit for Review', roles: ['app_editor'] },
    { from: 'draft', to: 'archived', label: 'Archive', roles: ['app_admin'] },
  ];

  it('renders buttons for available transitions', () => {
    render(TransitionButtons, {
      props: { transitions, loading: false },
    });

    expect(screen.getByText('Submit for Review')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
  });

  it('clicking a transition button calls onTransition with target state', async () => {
    const onTransition = vi.fn();

    render(TransitionButtons, {
      props: { transitions, onTransition, loading: false },
    });

    await fireEvent.click(screen.getByText('Submit for Review'));
    expect(onTransition).toHaveBeenCalledWith('review');
  });

  it('renders nothing when transitions array is empty', () => {
    const { container } = render(TransitionButtons, {
      props: { transitions: [], loading: false },
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('disables buttons when loading is true', () => {
    render(TransitionButtons, {
      props: { transitions, loading: true },
    });

    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.hasAttribute('disabled')).toBe(true);
    }
  });
});
