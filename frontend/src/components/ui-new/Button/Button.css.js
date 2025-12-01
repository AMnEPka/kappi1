import { css } from '@emotion/react';

export const useButtonStyles = () => {
  return {
    base: css`
      inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
    `,
    
    variants: {
      default: css`
        background: #facc15; /* yellow-400 */
        color: #000;
        shadow-sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)';
        
        &:hover {
          background: #facc15e6; /* yellow-400/90 */
          shadow-md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
        }
      `,
      destructive: css`
        background: #dc2626; /* red-600 */
        color: white;
        shadow-sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)';
        
        &:hover {
          background: #dc2626e6; /* red-600/90 */
        }
      `,
      outline: css`
        border: 1px solid #e5e7eb; /* gray-200 */
        background: white;
        shadow-sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)';
        
        &:hover {
          background: #f9fafb; /* gray-50 */
          color: #374151; /* gray-700 */
        }
      `,
      outline_green: css`
        border: 1px solid #e5e7eb;
        background: white;
        shadow-sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)';
        
        &:hover {
          background: #059669; /* green-600 */
          color: white;
        }
      `
    },
    
    sizes: {
      default: css`h-10 px-4 py-2`,
      sm: css`h-9 rounded-lg px-3 text-xs`,
      lg: css`h-11 rounded-lg px-8`,
      xl: css`h-12 rounded-lg px-8 text-base`,
      icon: css`h-10 w-10`,
      "icon-lg": css`h-12 w-12`
    }
  };
};