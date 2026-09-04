/**
 * Rollout Controller & Emergency Kill Switch — Canary Feature Flags
 *
 * Controls tenant-level canary rollout for universal hydration and provides an
 * emergency kill switch for instant fallback to legacy readers.
 */

export interface RolloutConfig {
  enabledAccounts: Set<string>;
  disabledAccounts: Set<string>;
  shadowAccounts: Set<string>;
  globalKillSwitch: boolean;
}

export class RolloutController {
  private static config: RolloutConfig = {
    enabledAccounts: new Set(["*"]), // Enabled globally by default
    disabledAccounts: new Set(),
    shadowAccounts: new Set(),
    globalKillSwitch: false,
  };

  /**
   * Checks if universal field hydration engine is active for an account.
   */
  public static isHydrationEngineEnabled(accountId: string): boolean {
    if (this.config.globalKillSwitch) {
      return false;
    }

    if (this.config.disabledAccounts.has(accountId)) {
      return false;
    }

    if (this.config.enabledAccounts.has("*") || this.config.enabledAccounts.has(accountId)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if an account is running in shadow mode.
   */
  public static isShadowModeEnabled(accountId: string): boolean {
    return this.config.shadowAccounts.has(accountId);
  }

  /**
   * Enables canary rollout for a specific account.
   */
  public static enableAccountCanary(accountId: string) {
    this.config.enabledAccounts.add(accountId);
    this.config.disabledAccounts.delete(accountId);
  }

  /**
   * Emergency kill switch to disable universal hydration for an account or globally.
   */
  public static disableUniversalHydration(accountId?: string) {
    if (!accountId || accountId === "*") {
      this.config.globalKillSwitch = true;
    } else {
      this.config.disabledAccounts.add(accountId);
    }
  }

  /**
   * Resets rollout configuration to defaults.
   */
  public static resetRolloutConfig() {
    this.config.enabledAccounts = new Set(["*"]);
    this.config.disabledAccounts = new Set();
    this.config.shadowAccounts = new Set();
    this.config.globalKillSwitch = false;
  }
}
