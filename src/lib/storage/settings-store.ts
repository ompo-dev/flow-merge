import { getDb, type SettingKey, type SettingValueMap } from "@/lib/storage/db";

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValueMap[K] | null> {
  const db = await getDb();
  const record = await db.get("settings", key);
  return (record?.value as SettingValueMap[K] | undefined) ?? null;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValueMap[K]) {
  const db = await getDb();
  await db.put("settings", {
    key,
    value,
  });
}

export async function deleteSetting(key: SettingKey) {
  const db = await getDb();
  await db.delete("settings", key);
}
