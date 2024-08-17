import express from "express";
import path from "path";
import * as fs from "fs";
import contentDisposition from "content-disposition";

const app = express();

let port = 3000;

let isUsingObjectStorage = false;

if (process.argv[2] && parseInt(process.argv[2])) {
  port = parseInt(process.argv[2]);
}

if (process.argv[3] && process.argv[3] === true) {
  isUsingObjectStorage = true;
}

const distributionFolder = path.join(import.meta.dirname, "..", "distribution");
const cacheFolder = path.join(distributionFolder, "cache");
const windowsCacheFile = path.join(cacheFolder, "windows.json");
const moduleVersionFile = path.join(cacheFolder, "module_versions.json");
const hostVersionFile = path.join(cacheFolder, "host_version.json");

if (!fs.existsSync(windowsCacheFile)) {
  fs.closeSync(fs.openSync(windowsCacheFile, "w"));
}

if (!fs.existsSync(moduleVersionFile)) {
  fs.closeSync(fs.openSync(moduleVersionFile, "w"));
}

if (!fs.existsSync(hostVersionFile)) {
  fs.writeFileSync(
    hostVersionFile,
    JSON.stringify({ windows: null, macOS: null, linux: null })
  );
}

const patched_versions = JSON.parse(
  fs.readFileSync(path.join(distributionFolder, "patched_versions.json"), {
    encoding: "utf-8",
  })
);

const setupNames = JSON.parse(
  fs.readFileSync(path.join(distributionFolder, "setup_names.json"), {
    encoding: "utf-8",
  })
);

function setDownloadHeaders(res, path) {
  switch (true) {
    case path.includes("win"): {
      res.header(
        "content-type",
        "application/vnd.microsoft.portable-executable"
      );
      res.header(
        "Content-Disposition",
        `attachment; filename=${setupNames.windows}`
      );
      break;
    }
  }
}

// tar.br files need to be application/octet-stream
function setPatchedHeaders(res, path) {
  res.setHeader("content-length", fs.statSync(path).size);
  if (path.includes(".distro")) {
    res.setHeader("content-type", "application/octet-stream");
  }
  res.setHeader("Content-Disposition", contentDisposition(path));
}

if (!isUsingObjectStorage) {
  app.use(
    "/download/setup",
    express.static(path.join(distributionFolder, "download"), {
      index: false,
      setHeaders: setDownloadHeaders,
    })
  );
  app.use(
    "/download/patched",
    express.static(path.join(distributionFolder, "patched"), {
      index: false,
      setHeaders: setPatchedHeaders,
    })
  );
}

app.get(
  "/api/updates/windows/distributions/app/manifests/latest",
  async (req, res) => {
    let updateInfo = fs.readFileSync(windowsCacheFile, {
      encoding: "utf-8",
    });
    const hostVersion = JSON.parse(
      fs.readFileSync(hostVersionFile, {
        encoding: "utf-8",
      })
    );
    let moduleVersions = fs.readFileSync(moduleVersionFile, {
      encoding: "utf-8",
    });
    if (
      Math.abs(new Date() - fs.statSync(windowsCacheFile).mtime) >= 14400000 ||
      updateInfo === ""
    ) {
      updateInfo = await (
        await fetch(
          "https://updates.discord.com/distributions/app/manifests/latest?channel=stable&platform=win&arch=x64"
        )
      ).json();
      fs.writeFileSync(windowsCacheFile, JSON.stringify(updateInfo));
      if (hostVersion.windows === null) {
        hostVersion.windows = updateInfo.full.host_version;
        fs.writeFileSync(hostVersionFile, JSON.stringify(hostVersion));
      }
    } else {
      updateInfo = JSON.parse(updateInfo);
    }
    if (moduleVersions === "") {
      moduleVersions = {};
      for (const module of Object.keys(updateInfo.modules)) {
        if (!Object.keys(patched_versions.modules).includes(module)) {
          moduleVersions[module] =
            updateInfo.modules[module].full.module_version;
        }
      }
      fs.writeFileSync(moduleVersionFile, JSON.stringify(moduleVersions));
    } else {
      moduleVersions = JSON.parse(moduleVersions);
    }
    if (
      hostVersion.windows !== null &&
      hostVersion.windows.toString() !== updateInfo.full.host_version.toString()
    ) {
      hostVersion.windows = updateInfo.full.host_version;
      fs.writeFileSync(hostVersionFile, JSON.stringify(hostVersion));
      for (const module of Object.keys(moduleVersions)) {
        moduleVersions[module] = moduleVersions[module] + 1;
      }
    }
    updateInfo.full.host_version = patched_versions.host.version;
    updateInfo.full.package_sha256 = patched_versions.host.sha256;
    updateInfo.full.url = isUsingObjectStorage
      ? patched_versions.host.files.windows.full
      : `${req.protocol}://${req.header(
          "Host"
        )}/download/patched/host/${patched_versions.host.version.join(".")}/${
          patched_versions.host.files.windows.full
        }`;
    // updateInfo.deltas.map((x) => {x.host_version = [2024, 8, 1]; return x})
    updateInfo.deltas = [];
    for (const module of Object.keys(updateInfo.modules)) {
      if (Object.keys(patched_versions.modules).includes(module)) {
        updateInfo.modules[module].full.module_version =
          patched_versions.modules[module].version;
        updateInfo.modules[module].full.package_sha256 =
          patched_versions.modules[module].sha256;
        updateInfo.modules[module].full.url = isUsingObjectStorage
          ? patched_versions.modules[module].files.windows.full
          : `${req.protocol}://${req.get("Host")}/download/patched/${module}/${
              patched_versions.modules[module].version
            }/${patched_versions.modules[module].files.windows.full}`;
      } else {
        updateInfo.modules[module].full.module_version = moduleVersions[module];
      }
      updateInfo.modules[module].full.host_version =
        patched_versions.host.version;
      updateInfo.modules[module].deltas = [];
    }
    return res.json(updateInfo);
  }
);

app.get("/api/updates/stable", async (req, res) => {
  // query = osx

  /* {
    name: "2024.08.01",
    pub_date: "2024-08-05T22:11:50",
    url: "https://dl.discordapp.net/apps/osx/2024.08.01/Discord.zip",
    notes: "",
  } */

  // if query = linux and not latest version
  // return this
  /* {
  "name": "0.0.63",
  "pub_date": "2024-08-05T22:10:16"
  } */

  // if query = linux and is latest version
  // return 204
  return "";
});

// /api/modules/stable/versions.json?host_version=(host_version)
// query can be osx or linux
app.get("/api/modules/stable/versions.json", async (req, res) => {
  /*
  {
    discord_cloudsync: 1,
    discord_desktop_core: 1,
    discord_dispatch: 1,
    discord_erlpack: 1,
    discord_game_utils: 1,
    discord_krisp: 1,
    discord_modules: 1,
    discord_rpc: 1,
    discord_spellcheck: 1,
    discord_utils: 1,
    discord_voice: 1,
    discord_webauthn: 1,
    discord_zstd: 1,
  }
  */
  return "";
});

// /api/modules/(release_channel)/(module_name)/(module_version) returns module download in zip, content type: application/zip

// /api/download/stable?platform=linux&format=tar.gz or /api/download/stable?platform=linux&format=deb returns host download in .tar or .deb, same file as linux download on discord website
// content type is application/vnd.debian.binary-package and application/x-tar replypectively

// also get api/downloads/distributions/app/installers/latest?channel=stable&platform=win&arch=x64 as well
app.get("/api/download", function (req, res) {
  let pathToDownload;
  switch (req.query.platform) {
    case "win": {
      pathToDownload = setupNames.windows;
      break;
    }
  }
  if (!isUsingObjectStorage) {
    res.redirect(
      `../../download/setup/${req.query.platform}/${pathToDownload}`
    );
  } else {
    res.redirect(pathToDownload);
  }
});

app.listen(port, () => {
  console.log(`Wumpdle listening on ${port}`);
});
