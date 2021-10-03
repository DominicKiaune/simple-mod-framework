THREE = require("./three.min")
const QuickEntity = require("./quickentity")
const RPKG = require("./rpkg")

const fs = require("fs")
const path = require("path")
const emptyFolder = require("empty-folder")
const { promisify } = require("util")
const child_process = require("child_process")
const LosslessJSON = require("lossless-json")

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config.json")))

const rpkgInstance = new RPKG.RPKGInstance()

async function stageAllMods() {
    await rpkgInstance.waitForInitialised()

    try {
        await promisify(emptyFolder)("staging", true)
    } catch {}

    try {
        await promisify(emptyFolder)("temp", true)
    } catch {}

    try {
        await promisify(emptyFolder)("Output", true)
    } catch {}

    fs.mkdirSync("staging")
    fs.mkdirSync("temp")
    fs.mkdirSync("Output")

    var packagedefinition = []
    var undelete = []

    for (let mod of config.loadOrder) {
        let manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "Mods", mod, "manifest.json")))
        for (let chunkFolder of fs.readdirSync(path.join(process.cwd(), "Mods", mod, manifest.contentFolder))) {
            try {
                fs.mkdirSync(path.join(process.cwd(), "staging", chunkFolder))
            } catch {}

            for (let contentFile of fs.readdirSync(path.join(process.cwd(), "Mods", mod, manifest.contentFolder, chunkFolder))) {
                var contentType = contentFile.split(".").slice(1).join(".")
                var contentFilePath = path.join(process.cwd(), "Mods", mod, manifest.contentFolder, chunkFolder, contentFile)

                switch (contentType) {
                    case "entity.json":
                        var entityContent = LosslessJSON.parse(String(fs.readFileSync(contentFilePath)))
                        await QuickEntity.generate("HM3", contentFilePath,
                                                    path.join(process.cwd(), "temp", "temp.TEMP.json"),
                                                    path.join(process.cwd(), "temp", "temp.TEMP.meta.json"),
                                                    path.join(process.cwd(), "temp", "temp.TBLU.json"),
                                                    path.join(process.cwd(), "temp", "temp.TBLU.meta.json")) // Generate the RT files from the QN json
                        
                        child_process.execSync("ResourceTool.exe HM3 generate TEMP \"" + path.join(process.cwd(), "temp", "temp.TEMP.json") + "\" \"" + path.join(process.cwd(), "temp", "temp.TEMP") + "\" --simple")
                        child_process.execSync("ResourceTool.exe HM3 generate TBLU \"" + path.join(process.cwd(), "temp", "temp.TBLU.json") + "\" \"" + path.join(process.cwd(), "temp", "temp.TBLU") + "\" --simple")
                        await rpkgInstance.callFunction(`-json_to_hash_meta "${path.join(process.cwd(), "temp", "temp.TEMP.meta.json")}"`)
                        await rpkgInstance.callFunction(`-json_to_hash_meta "${path.join(process.cwd(), "temp", "temp.TBLU.meta.json")}"`) // Generate the binary files from the RT json

                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TEMP"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tempHash + ".TEMP"))
                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TEMP.meta"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tempHash + ".TEMP.meta"))
                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TBLU"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tempHash + ".TBLU"))
                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TBLU.meta"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tempHash + ".TBLU.meta")) // Copy the binary files to the staging directory
                        break;
                    case "entity.patch.json":
                        var entityContent = LosslessJSON.parse(String(fs.readFileSync(contentFilePath)))
                        var tempRPKG = await rpkgInstance.getRPKGOfHash(entityContent.tempHash)
                        var tbluRPKG = await rpkgInstance.getRPKGOfHash(entityContent.tbluHash)

                        await rpkgInstance.callFunction(`-extract_from_rpkg "${path.join(config.runtimePath, tempRPKG + ".rpkg")}" -filter "${entityContent.tempHash}" -output_path temp`)
                        await rpkgInstance.callFunction(`-extract_from_rpkg "${path.join(config.runtimePath, tbluRPKG + ".rpkg")}" -filter "${entityContent.tbluHash}" -output_path temp`) // Extract the binary files

                        child_process.execSync("ResourceTool.exe HM3 convert TEMP \"" + path.join(process.cwd(), "temp", tempRPKG, "TEMP", entityContent.tempHash + ".TEMP") + "\" \"" + path.join(process.cwd(), "temp", tempRPKG, "TEMP", entityContent.tempHash + ".TEMP") + ".json\" --simple")
                        child_process.execSync("ResourceTool.exe HM3 convert TBLU \"" + path.join(process.cwd(), "temp", tempRPKG, "TBLU", entityContent.tbluHash + ".TBLU") + "\" \"" + path.join(process.cwd(), "temp", tempRPKG, "TBLU", entityContent.tbluHash + ".TBLU") + ".json\" --simple")
                        await rpkgInstance.callFunction(`-hash_meta_to_json "${path.join(process.cwd(), "temp", tempRPKG, "TEMP", entityContent.tempHash + ".TEMP.meta")}"`)
                        await rpkgInstance.callFunction(`-hash_meta_to_json "${path.join(process.cwd(), "temp", tempRPKG, "TBLU", entityContent.tbluHash + ".TBLU.meta")}"`) // Generate the RT files from the binary files

                        await QuickEntity.convert("HM3", "ids",
                                                path.join(process.cwd(), "temp", tempRPKG, "TEMP", entityContent.tempHash + ".TEMP.json"),
                                                path.join(process.cwd(), "temp", tempRPKG, "TEMP", entityContent.tempHash + ".TEMP.meta.json"),
                                                path.join(process.cwd(), "temp", tempRPKG, "TBLU", entityContent.tbluHash + ".TBLU.json"),
                                                path.join(process.cwd(), "temp", tempRPKG, "TBLU", entityContent.tbluHash + ".TBLU.meta.json"),
                                                path.join(process.cwd(), "temp", "QuickEntityJSON.json")) // Generate the QN json from the RT files

                        await QuickEntity.applyPatchJSON(path.join(process.cwd(), "temp", "QuickEntityJSON.json"), contentFilePath, path.join(process.cwd(), "temp", "PatchedQuickEntityJSON.json")) // Patch the QN json

                        await QuickEntity.generate("HM3", path.join(process.cwd(), "temp", "PatchedQuickEntityJSON.json"),
                                                    path.join(process.cwd(), "temp", "temp.TEMP.json"),
                                                    path.join(process.cwd(), "temp", "temp.TEMP.meta.json"),
                                                    path.join(process.cwd(), "temp", "temp.TBLU.json"),
                                                    path.join(process.cwd(), "temp", "temp.TBLU.meta.json")) // Generate the RT files from the QN json
                        
                        child_process.execSync("ResourceTool.exe HM3 generate TEMP \"" + path.join(process.cwd(), "temp", "temp.TEMP.json") + "\" \"" + path.join(process.cwd(), "temp", "temp.TEMP") + "\" --simple")
                        child_process.execSync("ResourceTool.exe HM3 generate TBLU \"" + path.join(process.cwd(), "temp", "temp.TBLU.json") + "\" \"" + path.join(process.cwd(), "temp", "temp.TBLU") + "\" --simple")
                        await rpkgInstance.callFunction(`-json_to_hash_meta "${path.join(process.cwd(), "temp", "temp.TEMP.meta.json")}"`)
                        await rpkgInstance.callFunction(`-json_to_hash_meta "${path.join(process.cwd(), "temp", "temp.TBLU.meta.json")}"`) // Generate the binary files from the RT json

                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TEMP"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tempHash + ".TEMP"))
                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TEMP.meta"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tempHash + ".TEMP.meta"))
                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TBLU"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tbluHash + ".TBLU"))
                        fs.copyFileSync(path.join(process.cwd(), "temp", "temp.TBLU.meta"), path.join(process.cwd(), "staging", chunkFolder, entityContent.tbluHash + ".TBLU.meta")) // Copy the binary files to the staging directory
                        break;
                    default:
                        fs.copyFileSync(contentFilePath, path.join(process.cwd(), "staging", chunkFolder, contentFile)) // Copy the file to the staging directory
                        break;
                }

                try {
                    await promisify(emptyFolder)("temp", true)
                } catch {}
                fs.mkdirSync("temp") // Clear the temp directory
            }
        } // Content

        packagedefinition.push(...manifest.packagedefinition)
        undelete.push(...manifest.undelete)
    }

    await rpkgInstance.callFunction(`-decrypt_packagedefinition_thumbs "${path.join(config.runtimePath, "packagedefinition.txt")}" -output_path "${path.join(process.cwd(), "temp")}"`)
    fs.writeFileSync(path.join(process.cwd(), "temp", "packagedefinition.txt.decrypted"), String(fs.readFileSync(path.join(process.cwd(), "temp", "packagedefinition.txt.decrypted"))).replace(/patchlevel=[0-9]*/g, "patchlevel=10001"))
    await rpkgInstance.callFunction(`-encrypt_packagedefinition_thumbs "${path.join(process.cwd(), "temp", "packagedefinition.txt.decrypted")}" -output_path "${path.join(process.cwd(), "temp")}"`)

    if (config.skipIntro) {
        await rpkgInstance.callFunction(`-decrypt_packagedefinition_thumbs "${path.join(config.runtimePath, "..", "Retail", "thumbs.dat")}" -output_path "${path.join(process.cwd(), "temp")}"`)
        fs.writeFileSync(path.join(process.cwd(), "temp", "thumbs.dat.decrypted"), String(fs.readFileSync(path.join(process.cwd(), "temp", "thumbs.dat.decrypted"))).replace("Boot.entity", "MainMenu.entity"))
        await rpkgInstance.callFunction(`-encrypt_packagedefinition_thumbs "${path.join(process.cwd(), "temp", "thumbs.dat.decrypted")}" -output_path "${path.join(process.cwd(), "temp")}"`)
    }

    fs.copyFileSync(path.join(process.cwd(), "temp", "packagedefinition.txt.decrypted.encrypted"), path.join(process.cwd(), "Output", "packagedefinition.txt"))
    fs.copyFileSync(path.join(process.cwd(), "temp", "thumbs.dat.decrypted.encrypted"), path.join(process.cwd(), "Output", "thumbs.dat"))

    try {
        await promisify(emptyFolder)("temp", true)
    } catch {}
    fs.mkdirSync("temp")

    for (let stagingChunkFolder of fs.readdirSync(path.join(process.cwd(), "staging"))) {
        await rpkgInstance.callFunction(`-generate_rpkg_from "${path.join(process.cwd(), "staging", stagingChunkFolder)}" -output_path "${path.join(process.cwd(), "staging")}"`)
        fs.copyFileSync(path.join(process.cwd(), "staging", stagingChunkFolder + ".rpkg"), path.join(process.cwd(), "Output", stagingChunkFolder + "patch200.rpkg"))
    }
}

stageAllMods()