import ProgressBar from "progress";

export class RecipientProgress {
  private progress: ProgressBar;

  constructor() {
    this.progress = new ProgressBar("Processed: :current / Success :success / Errors: :retries / Invalid :invalid / Active :active  ", {
      total: 1000000,
    });

    this.progress.tick(0, {
      success: 0,
      invalid: 0,
      retries: 0,
      active: 0,
    });
  }

  public tick(token: "success" | "invalid" | "retries" | "active", tickCounter: number = 1, tokenCounter: number = 1) {
    const tokens = this.getTokens();
    tokens[token] += tokenCounter;
    this.progress.tick(tickCounter, tokens);
  }

  public getTokens(): { success: number; invalid: number; retries: number; active: number } {
    return {
      success: (this.progress as any)?.tokens?.success || 0,
      invalid: (this.progress as any)?.tokens?.invalid || 0,
      retries: (this.progress as any)?.tokens?.retries || 0,
      active: (this.progress as any)?.tokens?.active || 0,
    };
  }

  public end() {
    this.progress.terminate();
  }
}
