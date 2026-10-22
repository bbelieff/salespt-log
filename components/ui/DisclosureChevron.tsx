import React from 'react';
import { ChevronDown } from 'lucide-react';
import './disclosure-chevron.css';

interface Props {
  /** Omit only inside a native details > summary.disclosure-summary. */
  open?: boolean;
  className?: string;
}

/** Decorative only: the parent button/summary owns focus, events and expanded semantics. */
export default function DisclosureChevron({open, className = ''}: Props) {
  return <ChevronDown data-disclosure-chevron data-disclosure-native={open === undefined ? '' : undefined} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false"
    className={`inline-block shrink-0 align-middle transition-transform duration-150 motion-reduce:transition-none ${className}`}
    style={open === undefined ? undefined : {transform: `rotate(${open ? 180 : 0}deg)`}} />;
}
