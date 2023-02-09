import fs from 'fs-extra';
import { env, exit } from 'node:process';
import { basename, join, relative, resolve } from 'node:path';
import dotenv from 'dotenv';
import { simpleGit } from 'simple-git';
import { getInput } from '@actions/core';
import { context } from '@actions/github';
import { Octokit } from 'octokit';
import { RequestError } from '@octokit/request-error';
import JSZip from 'jszip';
import {
    clean,
    coerce,
    parse,
    satisfies,
    valid,
    Range as SemVerRange,
} from 'semver';

dotenv.config();

if (!env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.error('GitHub PAT not set.');
    exit(1);
}

const { pusher } = context.payload;
const gitConfigName: string = getInput('git-config-email')
    ? getInput('git-config-email')
    : (pusher?.name
        ? pusher.name
        : (env.GITHUB_ACTOR
            ? env.GITHUB_ACTOR
            : 'GitHub Workflow Update and Release'));
const gitConfigEmail: string = getInput('git-config-email')
    ? getInput('git-config-email')
    : (pusher?.email
        ? pusher.email
        : `${env.GITHUB_ACTOR ?? 'github-workflow-update-and-release'}@users.noreply.github.com`);

const REPO = { owner: 'toebeann', repo: 'bepinex.chainedechoes' };
const BEPINEX_REPO = { owner: 'BepInEx', repo: 'BepInEx' };
const PAYLOAD_DIR = 'payload';
const DIST_DIR = 'dist';
const METADATA_FILE = '.metadata.json';
const BepInExReleaseTypes = ['x86', 'x64', 'unix'] as const;
const UNITY_VERSION = '2020.3.36';
const corlibsFilter = (corlib: string) => corlib === 'mscorlib.dll';

type BepInExReleaseType = typeof BepInExReleaseTypes[number];
type Release = Awaited<ReturnType<typeof octokit.rest.repos.getRelease>>['data'];
type Asset = Release['assets'][0];

interface Metadata {
    version?: string,
    source?: string,
    payloadVersion?: string
}

const assetFilter = (asset: Asset, type: BepInExReleaseType, unityMono: boolean) =>
    asset.name.toLowerCase().includes(type.toLowerCase())
    && (!unityMono || asset.name.toLowerCase().includes('unitymono'));

const getAsset = (release: Release, type: BepInExReleaseType) =>
    release.assets.find(asset => assetFilter(asset, type, true))
    ?? release.assets.find(asset => assetFilter(asset, type, false));

const getVersion = (release: Release) => {
    const cleaned = clean(release.tag_name, true);
    const validated = valid(cleaned, true);

    return validated
        ? validated
        : coerce(cleaned, { loose: true })?.version;
};

const getMetadata = async (): Promise<Metadata> => {
    try {
        return await fs.readJson(METADATA_FILE) as Metadata;
    } catch {
        return {
            version: '0'
        };
    }
};

const createMetadata = (release: Release): Metadata => {
    return {
        version: getVersion(release),
        source: release.html_url,
        payloadVersion: env.npm_package_version
    };
};

const writeMetadataToDisk = (metadata: Metadata) => fs.writeJson(METADATA_FILE, metadata);

const getFileNames = async (path: string) => {
    const files: string[] = [];
    try {
        const entries = await fs.readdir(resolve(path), { withFileTypes: true });
        for (const entry of entries) {
            const resolved = resolve(path, entry.name);
            if (entry.isDirectory()) {
                files.push(...await getFileNames(resolved));
            } else {
                files.push(resolved);
            }
        }
    } catch { }
    return files;
}

const handleReleaseError = (error: unknown, repo: { owner: string, repo: string }) => {
    // an error occured while attempting to get the latest release
    if (error instanceof RequestError) {
        const message = error.status === 404
            ? 'No releases were found'
            : 'Could not retrieve releases';

        console.error(`${message} for repo: /${repo.owner}/${repo.repo}`, `${error.status} ${error.message}`);
    } else {
        console.error(`Could not retrieve releases for repo: /${repo.owner}/${repo.repo}`, error);
    }
};

const handleAssetError = (error: unknown, type: BepInExReleaseType) => {
    // an error occured while attempting to get the latest release
    if (error instanceof RequestError) {
        const message = error.status === 404
            ? `${type} asset not found`
            : `Could not retrieve ${type} asset`;

        console.error(`${message} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`, `${error.status} ${error.message}`);
    } else {
        console.error(`Could not retrieve ${type} asset for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`, error);
    }
};

const downloadAsset = async (asset: Asset, type: BepInExReleaseType) => {
    console.log(`Downloading ${type} archive...`);

    let response: Awaited<ReturnType<typeof octokit.request>>;
    try {
        const getReleaseAssetStream = octokit.rest.repos.getReleaseAsset.defaults({
            headers: {
                accept: 'application/octet-stream'
            }
        });

        response = (await octokit.request(`${getReleaseAssetStream.endpoint.DEFAULTS.method} ${getReleaseAssetStream.endpoint.DEFAULTS.url}`, {
            ...getReleaseAssetStream.endpoint.DEFAULTS,
            ...BEPINEX_REPO,
            asset_id: asset.id
        }));
    } catch (error) {
        handleAssetError(error, type);
        return;
    }

    if (!(response.data instanceof ArrayBuffer)) {
        console.error(`Invalid data for ${type} asset: ${typeof response.data}`);
        return;
    }

    return response.data;
}

const downloadCorlibs = async (unityVersion: string) => {
    console.log(`Downloading core librariess for Unity version: ${unityVersion}...`);

    try {
        const response = await fetch(`https://unity.bepinex.dev/corlibs/${unityVersion}.zip`);

        if (!response.ok) {
            console.error(`Could not retrieve corlibs for Unity version: ${unityVersion}`, response.status, response.statusText, response.url);
            return;
        }

        return response.arrayBuffer();
    } catch (error) {
        console.error(`Could not retrieve corlibs for Unity version: ${unityVersion}`, error);
    }
}

const embedPayload = async (archive: JSZip, type: BepInExReleaseType) => {
    console.log(`Embedding payload in ${type} archive...`);

    // embed payload
    for (const path of (await getFileNames(PAYLOAD_DIR)).sort()) {
        const name = basename(path);
        const ext = name.split('.').at(-1);

        let relativePath = relative(PAYLOAD_DIR, path);
        if (ext && BepInExReleaseTypes.includes(ext as BepInExReleaseType)) {
            if (ext !== type) {
                continue;
            }

            relativePath = relativePath.substring(0, relativePath.length - ext.length - 1); // trim the extension from the path
        }

        archive.file(relativePath, await fs.readFile(path));
    }

    return archive;
}

const embedCorlibs = async (archive: JSZip, buffer: ArrayBuffer, type: BepInExReleaseType) => {
    console.log(`Embedding corlibs in ${type} archive...`);

    const corlibs = await JSZip.loadAsync(buffer);
    for (const path of Object.keys(corlibs.files).filter(corlibsFilter)) {
        archive.file(join('corlibs', path), await corlibs.file(path)!.async('uint8array'));
    }

    return archive;
}

const writeZipToDisk = async (path: string, archive: JSZip, type: BepInExReleaseType) => {
    console.log(`Writing ${type} archive to disk...`);
    const data = await archive.generateInternalStream({ type: 'uint8array' }).accumulate();
    await fs.writeFile(resolve(path), data);
}

const handleAsset = async (release: Release, type: BepInExReleaseType, corlibsBuffer?: ArrayBuffer) => {
    let asset: ReturnType<typeof getAsset>;

    try {
        asset = getAsset(release, type);
        if (asset) {
            const assetBuffer = await downloadAsset(asset, type);
            if (assetBuffer) {
                const archive = await embedPayload(await JSZip.loadAsync(assetBuffer), type);
                if (corlibsBuffer) {
                    await embedCorlibs(archive, corlibsBuffer, type);
                }
                await fs.ensureDir(DIST_DIR);
                await writeZipToDisk(join(DIST_DIR, asset.name), archive, type);
                return { asset, type, success: true };
            } else {
                return { asset, type, success: false };
            }
        } else {
            return { asset, type, success: false };
        }
    } catch {
        return { asset, type, success: false };
    }
}

const octokit = new Octokit({
    auth: env.GITHUB_PERSONAL_ACCESS_TOKEN
});

console.log('Getting latest release...');
let latestRelease: Release | undefined;
try {
    latestRelease = (await octokit.rest.repos.getLatestRelease(REPO)).data;
} catch (error) {
    handleReleaseError(error, REPO);
}

const latestReleaseVersion = latestRelease
    ? getVersion(latestRelease)
    : '0.0.0';

let latestBepInExRelease: Release;
try {
    latestBepInExRelease = (await octokit.rest.repos.getLatestRelease(BEPINEX_REPO)).data;
} catch (error) {
    handleReleaseError(error, BEPINEX_REPO);
    exit(1);
}

const previousMetadata = await getMetadata();
const metadata = createMetadata(latestBepInExRelease);

if (!env.npm_package_version) {
    env.npm_package_version = (await fs.readJson('package.json')).version;
    if (!env.npm_package_version) {
        console.error('Could not get current package version!');
        exit(1);
    }
}

const version = `${metadata.version}-payload.${parse(env.npm_package_version, true)}`;

console.log(`Latest release: ${latestReleaseVersion}`);
console.log(`New version: ${version}`);

if (metadata.version
    && satisfies(metadata.version, new SemVerRange(`<= ${previousMetadata.version}`), { loose: true, includePrerelease: true }) // check bepinex release
    && satisfies(version, new SemVerRange(`<= ${latestReleaseVersion}`, { loose: true, includePrerelease: true }))) { // check internal version
    // both bepinex and this package have not released an update since last check, so we should cancel
    console.log('No updates since last check.');
    exit(0);
}

// we have a new (or unknown) release, let's handle it
const corlibsBuffer = await downloadCorlibs(UNITY_VERSION);
if (!corlibsBuffer) exit(1);

const handled = await Promise.all([
    handleAsset(latestBepInExRelease, 'x64', corlibsBuffer),
    handleAsset(latestBepInExRelease, 'unix', corlibsBuffer)
]); // create assets

// check for failures
const failed = handled.filter(result => !result.success && result.asset);
if (failed.length > 0) {
    for (const failure of failed) {
        console.error(`Failed to handle ${failure.type} asset`, failure.asset);
    }
    console.error(`Encountered errors handling assets from repo /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
    exit(1);
}

if (handled.every(result => !result.success)) {
    console.error(`No valid assets were found in repo /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
    exit(1);
}

// at this point all assets have been successfully downloaded and saved to disk with embedded payloads
await writeMetadataToDisk(metadata); // update metadata

if (env.MODE !== 'dev') {
    const git = simpleGit();
    const status = await git.status();
    const changedFiles = [...status.not_added, ...status.modified];
    const metadataPath = changedFiles.find(file => file.endsWith(METADATA_FILE));

    if (metadataPath) {
        await git.addConfig('safe.directory', env.GITHUB_WORKSPACE || '', false, 'global');
        await git.addConfig('user.name', gitConfigName);
        await git.addConfig('user.email', gitConfigEmail);
        await git.addConfig('core.ignorecase', 'false');

        console.log('Committing metadata...');
        await git.add('.metadata.json');
        const commit = await git.commit('Updating metadata', [metadataPath]);
        await git.push();

        try {
            console.log('Creating release...');
            const release = await octokit.rest.repos.createRelease({
                ...REPO,
                tag_name: `v${version}`,
                target_commitish: commit.commit,
                name: latestBepInExRelease.name ?? `BepInEx ${metadata.version}`,
                body: latestBepInExRelease.body ?? undefined,
                generate_release_notes: true
            });

            console.log('Uploading release assets...');
            const assets = await getFileNames(DIST_DIR);
            for await (const asset of assets) {
                const uploadReleaseAsset = octokit.rest.repos.uploadReleaseAsset.defaults({
                    headers: {
                        'content-type': latestBepInExRelease.assets.find(a => a.name === basename(asset))?.content_type ?? 'application/x-zip-compressed'
                    }
                });
                await octokit.request(`${uploadReleaseAsset.endpoint.DEFAULTS.method} ${uploadReleaseAsset.endpoint.DEFAULTS.url}`, {
                    ...uploadReleaseAsset.endpoint.DEFAULTS,
                    ...REPO,
                    release_id: release.data.id,
                    name: basename(asset),
                    data: (await fs.readFile(asset))
                });
            }
        } catch (error) {
            console.error(error);
            exit(1);
        }
    } else {
        console.error('Metadata unchanged!');
        exit(1);
    }
}
