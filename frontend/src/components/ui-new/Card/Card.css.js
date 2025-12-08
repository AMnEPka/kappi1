import { css } from '@emotion/react';

export const cardStyles = {
  base: css`
    background-color: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
    border-radius: var(--md-sys-shape-corner-lg);
    transition: box-shadow var(--md-sys-motion-duration-medium4) var(--md-sys-motion-easing-standard);
  `,
  
  header: css`
    padding: var(--md-sys-spacing-6) var(--md-sys-spacing-6) var(--md-sys-spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-1);
  `,
  
  title: css`
    font-family: var(--md-sys-typescale-title-large-font);
    font-size: var(--md-sys-typescale-title-large-size);
    font-weight: var(--md-sys-typescale-title-large-weight);
    line-height: var(--md-sys-typescale-title-large-line-height);
    color: var(--md-sys-color-on-surface);
    margin: 0;
  `,
  
  description: css`
    font-family: var(--md-sys-typescale-body-medium-font, var(--md-sys-typescale-body-large-font));
    font-size: var(--md-sys-typescale-body-medium-size, 0.875rem);
    font-weight: var(--md-sys-typescale-body-medium-weight, 400);
    line-height: var(--md-sys-typescale-body-medium-line-height, 1.25rem);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
  `,
  
  content: css`
    padding: var(--md-sys-spacing-4) var(--md-sys-spacing-6);
  `,
  
  footer: css`
    padding: var(--md-sys-spacing-4) var(--md-sys-spacing-6) var(--md-sys-spacing-6);
    display: flex;
    align-items: center;
    gap: var(--md-sys-spacing-2);
  `,
};

