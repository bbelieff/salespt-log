"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FollowUpGroup } from "@/lib/analytics/dashboard-follow-ups";
type Selection = {
    step: string;
    group: FollowUpGroup | "all" | "step";
};
/** Mouse hover and explicit touch/keyboard activation share one dismiss boundary. */
export function useFollowUpsPopover(active: Selection | null, setActive: (value: Selection | null) => void, resetDetails: () => void) {
    const card = useRef<HTMLElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const anchor = useRef<HTMLElement | null>(null);
    const trigger = useRef<HTMLElement | null>(null);
    const timers = useRef<{
        open?: ReturnType<typeof setTimeout>;
        close?: ReturnType<typeof setTimeout>;
    }>({});
    const focusOnOpen = useRef(false);
    const explicitOpen = useRef(false);
    const [position, setPosition] = useState({ left: 12, top: 12, width: 740 });
    const [connector, setConnector] = useState<{ left: number; top: number; width: number; height: number; sourceY: number; targetY: number } | null>(null);
    const cancelClose = useCallback(() => { clearTimeout(timers.current.close); timers.current.close = undefined; }, []);
    const cancelOpen = useCallback(() => { clearTimeout(timers.current.open); timers.current.open = undefined; }, []);
    const close = useCallback((restoreFocus = true) => {
        cancelOpen();
        cancelClose();
        setActive(null);
        if (restoreFocus)
            trigger.current?.focus({ preventScroll: true });
    }, [cancelOpen, cancelClose, setActive]);
    function open(element: HTMLElement, step: string, group: Selection["group"], explicit = false) {
        cancelOpen();
        cancelClose();
        trigger.current = element.matches("button") ? element : element.querySelector("button");
        // Stable row anchoring prevents a filtered chip click moving the popup under the pointer.
        anchor.current = element.closest<HTMLElement>(".ft-summary-row") ?? element;
        focusOnOpen.current = explicit;
        if (explicit && explicitOpen.current && active?.step === step && active.group === group) {
            close();
            return;
        }
        explicitOpen.current = explicit;
        resetDetails();
        setActive({ step, group });
    }
    function hover(element: HTMLElement, step: string) {
        cancelOpen();
        cancelClose();
        if (active?.step === step)
            return;
        timers.current.open = setTimeout(() => open(element, step, "step"), 150);
    }
    const leave = useCallback(() => {
        cancelOpen();
        if (!timers.current.close)
            timers.current.close = setTimeout(() => close(false), 200);
    }, [cancelOpen, close]);
    useLayoutEffect(() => {
        if (!active)
            return;
        const place = () => {
            const a = anchor.current?.getBoundingClientRect(), p = panel.current?.getBoundingClientRect(), c = card.current?.getBoundingClientRect();
            if (!a || !p || !c)
                return;
            const rightSpace = window.innerWidth - c.right - 22;
            const rightSide = window.innerWidth >= 1024 && rightSpace >= 300;
            const width = Math.min(740, window.innerWidth - 24, rightSide ? rightSpace : 740);
            const left = rightSide ? c.right + 10 : Math.max(12, Math.min(a.left + a.width / 2 - width / 2, window.innerWidth - width - 12));
            const desired = rightSide ? a.top : a.bottom + p.height + 8 <= window.innerHeight - 12 ? a.bottom + 8 : a.top - p.height - 8;
            const top = Math.max(12, Math.min(desired, window.innerHeight - p.height - 12));
            setPosition(previous => previous.left === left && previous.top === top && previous.width === width ? previous : { left, width, top });
            // Keep both endpoints truthful even when the panel is vertically clamped.
            const y = a.top + a.height / 2;
            const targetY = Math.max(top + 16, Math.min(y, top + p.height - 16));
            const lineTop = Math.min(y, targetY) - 3;
            setConnector(rightSide && y >= 12 && y <= window.innerHeight - 12 ? { left: c.right - 1, top: lineTop, width: left - c.right + 2, height: Math.abs(y - targetY) + 6, sourceY: y - lineTop, targetY: targetY - lineTop } : null);
        };
        place();
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
        if (panel.current)
            observer?.observe(panel.current);
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        if (focusOnOpen.current) {
            panel.current?.focus({ preventScroll: true });
            focusOnOpen.current = false;
        }
        return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
    }, [active]);
    useEffect(() => {
        if (!active)
            return;
        const inside = (node: EventTarget | null) => node instanceof Node && (panel.current?.contains(node) || anchor.current?.contains(node));
        const outside = (event: PointerEvent) => { if (!inside(event.target))
            close(false); };
        const move = (event: PointerEvent) => {
            if (event.pointerType !== "mouse")
                return;
            const inStep = event.target instanceof Element && card.current?.contains(event.target) && event.target.closest(".ft-summary-row");
            if (inside(event.target) || inStep)
                cancelClose();
            else
                leave();
        };
        const escape = (event: KeyboardEvent) => { if (event.key === "Escape") {
            event.preventDefault();
            close();
        } };
        const focus = (event: FocusEvent) => { if (!inside(event.target))
            close(false); };
        const blur = () => close(false);
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        document.addEventListener("focusin", focus);
        window.addEventListener("blur", blur);
        return () => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape);
            document.removeEventListener("focusin", focus);
            window.removeEventListener("blur", blur);
        };
    }, [active, cancelClose, close, leave]);
    useEffect(() => () => { cancelOpen(); cancelClose(); }, [cancelOpen, cancelClose]);
    return { card, panel, position, connector, open, close, hover, leave, cancelClose };
}
