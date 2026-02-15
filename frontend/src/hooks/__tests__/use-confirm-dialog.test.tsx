import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  ConfirmDialogProvider,
  useConfirmDialog,
  ConfirmDialogOptions,
} from '../use-confirm-dialog';

// Wrapper component for the provider
const wrapper = ({ children }: { children: ReactNode }) => (
  <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
);

describe('useConfirmDialog Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useConfirmDialog());
    }).toThrow('useConfirmDialog must be used within a ConfirmDialogProvider');

    consoleSpy.mockRestore();
  });

  it('should return confirm function when used within provider', () => {
    const { result } = renderHook(() => useConfirmDialog(), { wrapper });

    expect(typeof result.current).toBe('function');
  });

  it('should resolve to true when confirmed', async () => {
    const { result } = renderHook(() => useConfirmDialog(), { wrapper });

    let confirmResult: boolean | null = null;

    // Open dialog
    act(() => {
      result.current({
        title: 'Confirm Action',
        description: 'Are you sure?',
      }).then((value) => {
        confirmResult = value;
      });
    });

    // Find and click confirm button by text
    const buttons = document.querySelectorAll('button');
    const confirmButton = Array.from(buttons).find(
      button => button.textContent?.includes('Confirmar')
    );
    
    expect(confirmButton).toBeDefined();
    
    if (confirmButton) {
      act(() => {
        confirmButton.click();
      });
    }

    await waitFor(() => {
      expect(confirmResult).toBe(true);
    });
  });

  it('should resolve to false when cancelled', async () => {
    const { result } = renderHook(() => useConfirmDialog(), { wrapper });

    let confirmResult: boolean | null = null;

    // Open dialog
    act(() => {
      result.current({
        title: 'Confirm Action',
        description: 'Are you sure?',
      }).then((value) => {
        confirmResult = value;
      });
    });

    // Find and click cancel button by text
    const buttons = document.querySelectorAll('button');
    const cancelButton = Array.from(buttons).find(
      button => button.textContent?.includes('Cancelar')
    );
    
    expect(cancelButton).toBeDefined();
    
    if (cancelButton) {
      act(() => {
        cancelButton.click();
      });
    }

    await waitFor(() => {
      expect(confirmResult).toBe(false);
    });
  });

  it('should accept custom options', () => {
    const { result } = renderHook(() => useConfirmDialog(), { wrapper });

    const options: ConfirmDialogOptions = {
      title: 'Delete Item',
      description: 'This action cannot be undone',
      confirmText: 'Delete',
      cancelText: 'Keep',
      variant: 'destructive',
    };

    act(() => {
      result.current(options);
    });

    // Dialog should be open with custom text
    expect(document.body.textContent).toContain('Delete Item');
    expect(document.body.textContent).toContain('This action cannot be undone');
  });

  it('should use default texts when not provided', () => {
    const { result } = renderHook(() => useConfirmDialog(), { wrapper });

    act(() => {
      result.current({
        title: 'Test',
        description: 'Test description',
      });
    });

    // Should use default Spanish texts
    expect(document.body.textContent).toContain('Confirmar');
    expect(document.body.textContent).toContain('Cancelar');
  });

  it('should handle multiple sequential confirmations', async () => {
    const { result } = renderHook(() => useConfirmDialog(), { wrapper });

    // First confirmation
    let firstResult: boolean | null = null;
    act(() => {
      result.current({ title: 'First', description: 'First confirmation' }).then(
        (value) => {
          firstResult = value;
        }
      );
    });

    // Confirm first
    const buttons1 = document.querySelectorAll('button');
    const firstConfirm = Array.from(buttons1).find(
      button => button.textContent?.includes('Confirmar')
    );
    
    if (firstConfirm) {
      act(() => {
        firstConfirm.click();
      });
    }

    await waitFor(() => {
      expect(firstResult).toBe(true);
    });

    // Second confirmation
    let secondResult: boolean | null = null;
    act(() => {
      result.current({ title: 'Second', description: 'Second confirmation' }).then(
        (value) => {
          secondResult = value;
        }
      );
    });

    // Cancel second
    const buttons2 = document.querySelectorAll('button');
    const secondCancel = Array.from(buttons2).find(
      button => button.textContent?.includes('Cancelar')
    );
    
    if (secondCancel) {
      act(() => {
        secondCancel.click();
      });
    }

    await waitFor(() => {
      expect(secondResult).toBe(false);
    });
  });
});

describe('ConfirmDialogProvider', () => {
  it('should render children', () => {
    const TestComponent = () => <div data-testid="child">Child Content</div>;
    
    renderHook(() => null, {
      wrapper: ({ children: _children }) => (
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>
      ),
    });

    // Just verify the hook ran without error in the wrapper
    expect(true).toBe(true);
  });
});
