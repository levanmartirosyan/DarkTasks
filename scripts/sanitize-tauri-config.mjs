import { readFileSync, writeFileSync } from "node:fs";

const configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const content = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");

JSON.parse(content);
writeFileSync(configPath, content, { encoding: "utf8" });
