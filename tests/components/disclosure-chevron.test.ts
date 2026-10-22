import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {readFileSync} from 'node:fs';
import DisclosureChevron from '@/components/ui/DisclosureChevron';

describe('shared disclosure indicator', () => {
  it('uses the single 16px lucide down path and fixed optical weight', () => {
    const html = renderToStaticMarkup(React.createElement(DisclosureChevron));
    expect(html).toContain('width="16"'); expect(html).toContain('height="16"');
    expect(html).toContain('stroke-width="1.75"'); expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"'); expect(html).toContain('focusable="false"');
    expect(html).not.toMatch(/<button|tabindex|role=/);
  });
  it('rotates open panels up and leaves native-details state to its parent CSS', () => {
    const open = renderToStaticMarkup(React.createElement(DisclosureChevron, {open:true}));
    const closed = renderToStaticMarkup(React.createElement(DisclosureChevron, {open:false}));
    const native = renderToStaticMarkup(React.createElement(DisclosureChevron, {className:'text-slate-400'}));
    expect(open).toContain('rotate(180deg)'); expect(closed).toContain('rotate(0deg)');
    expect(native).not.toContain('style='); expect(native).toContain('text-slate-400');
    expect(open).not.toContain('data-disclosure-native='); expect(closed).not.toContain('data-disclosure-native=');
    expect(open).toContain('motion-reduce:transition-none');
    expect(native).toContain('data-disclosure-native=""');
    const css = readFileSync('components/ui/disclosure-chevron.css', 'utf8');
    expect(css).toContain('details[open]>.disclosure-summary [data-disclosure-native]');
    expect(css).toContain('.disclosure-summary::-webkit-details-marker{display:none}');
    expect(css).not.toMatch(/^summary::/m);
  });
});
