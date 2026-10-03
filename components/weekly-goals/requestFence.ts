/** A late response cannot repopulate an editor after a newer request, denial, or unmount. */
export class GoalRequestFence {
  private generation = 0;
  private controller: AbortController | null = null;
  begin() {
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    return { signal: controller.signal, current: () => generation === this.generation && !controller.signal.aborted };
  }
  cancel() { this.generation++; this.controller?.abort(); this.controller = null; }
}
