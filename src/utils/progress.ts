import ProgressBar from "progress";

export class RecipientProgress {
  private progress: ProgressBar;

  constructor() {
    this.progress = new ProgressBar("Processed: :current / Success :success / Errors: :retries / Invalid :invalid  ", { total: 1000000 });

    this.progress.tick(0, {
      success: 0,
      invalid: 0,
      retries: 0,
    });
  }

  public success() {
    const success = (this.progress as any)?.tokens?.success || 0;
    const invalid = (this.progress as any)?.tokens?.invalid || 0;
    const retries = (this.progress as any)?.tokens?.retries || 0;
    this.progress.tick({
      success: success + 1,
      invalid,
      retries,
    });
  }

  public invalid() {
    const success = (this.progress as any)?.tokens?.success || 0;
    const invalid = (this.progress as any)?.tokens?.invalid || 0;
    const retries = (this.progress as any)?.tokens?.retries || 0;
    this.progress.tick({
      success,
      invalid: invalid + 1,
      retries,
    });
  }

  public retry() {
    const success = (this.progress as any)?.tokens?.success || 0;
    const invalid = (this.progress as any)?.tokens?.invalid || 0;
    const retries = (this.progress as any)?.tokens?.retries || 0;
    this.progress.tick({
      success,
      invalid,
      retries: retries + 1,
    });
  }

  public end() {
    this.progress.terminate();
  }
}