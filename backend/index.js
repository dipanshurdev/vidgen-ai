import express from "express";
import uniqid from "uniqid";
import fs from "fs";
import cors from "cors";
import { GPTScript, RunEventType } from "@gptscript-ai/gptscript";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";

const gptScript = new GPTScript();

const app = express();
app.use(cors());

app.get("/create-story", async (req, res) => {
  const url = req.query.url;
  const dir = uniqid();
  const path = "./story-data/" + dir;
  fs.mkdirSync(path, { recursive: true });

  try {
    const run = await gptScript.run("./read.gpt", {
      input: `--url ${url} --dir ${path}`,
      disableCache: true,
    });
    run.on(RunEventType.Event, (e) => {
      if (e.type === RunEventType.CallFinish && e.output) {
        console.log(e.output);
      }
    });
    const results = await run.text();

    return res.json(results);
  } catch (error) {
    console.log(error);
  }
});

app.listen(8888, () => {
  console.log("Server is going on port 3000");
});
