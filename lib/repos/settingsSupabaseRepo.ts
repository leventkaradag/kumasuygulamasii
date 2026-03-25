import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemSettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

// ─── Repository ───────────────────────────────────────────────────────────────

export const settingsSupabaseRepo = {
  /**
   * Get a boolean setting by key. Returns `defaultValue` if not found.
   */
  async getBoolean(key: string, defaultValue: boolean = true): Promise<boolean> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<Pick<SystemSettingRow, "value">>();

    if (error || !data) return defaultValue;
    return data.value === "true";
  },

  /**
   * Set a boolean setting by key. Uses upsert so the row is created if missing.
   */
  async setBoolean(key: string, value: boolean): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        { key, value: value ? "true" : "false", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      throw new Error(`system_settings.upsert: ${error.message}`);
    }
  },

  /**
   * Convenience: check if Boyahane -> Depo flow is enabled.
   */
  async isDyehouseToDepotEnabled(): Promise<boolean> {
    return this.getBoolean("dyehouse_to_depot_enabled", true);
  },

  /**
   * Convenience: set Boyahane -> Depo flow enabled/disabled.
   */
  async setDyehouseToDepotEnabled(enabled: boolean): Promise<void> {
    return this.setBoolean("dyehouse_to_depot_enabled", enabled);
  },
};
