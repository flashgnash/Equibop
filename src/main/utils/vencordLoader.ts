/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
import { join } from "path";

import { USER_AGENT } from "../constants";
import { State } from "../settings";
import { VENCORD_DIR } from "../vencordDir";
import { downloadFile, fetchie } from "./http";

const API_BASE = "https://api.github.com";
const ASAR_RELEASE_REPO = "flashgnash/Equicord";

export interface ReleaseData {
    name: string;
    tag_name: string;
    html_url: string;
    assets: Array<{
        id: number;
        name: string;
        updated_at: string;
        browser_download_url: string;
    }>;
}

export async function githubGet(endpoint: string) {
    const opts: RequestInit = {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": USER_AGENT
        }
    };

    if (process.env.GITHUB_TOKEN) (opts.headers! as any).Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    return fetchie(API_BASE + endpoint, opts, { retryOnNetworkError: true });
}

export async function downloadVencordAsar() {
    await downloadFile(
        "https://github.com/flashgnash/Equicord/releases/latest/download/equibop.asar",
        VENCORD_DIR,
        {},
        { retryOnNetworkError: true }
    );
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "equibop/main.js"));
}

export async function ensureVencordFiles() {
    if (existsSync(VENCORD_DIR)) return;

    await downloadVencordAsar();
}

// Like ensureVencordFiles, but also re-downloads when the FORK RELEASE has
// changed since the installed asar was fetched: every CI publish re-creates
// the release asset (new id + updated_at), so comparing that against a stored
// marker makes "push a new build" reach every install on its next launch —
// no manual Force Update needed. Offline / API failure falls back to the
// plain exists check so startup never breaks.
export async function ensureLatestVencordFiles() {
    try {
        const res = await githubGet(`/repos/${ASAR_RELEASE_REPO}/releases/latest`);
        const release: ReleaseData = await res.json();
        const asset = release.assets.find(a => a.name === "equibop.asar");
        if (asset) {
            const marker = `${release.tag_name}:${asset.id}:${asset.updated_at}`;
            if (marker !== State.store.equicordAsarMarker || !existsSync(VENCORD_DIR)) {
                console.log(`Equicord bundle outdated (have ${State.store.equicordAsarMarker ?? "none"}, latest ${marker}) — updating`);
                await downloadVencordAsar();
                State.store.equicordAsarMarker = marker;
            }
            return;
        }
    } catch (e) {
        console.error("Equicord bundle update check failed, using existing files", e);
    }

    await ensureVencordFiles();
}
