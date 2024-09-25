import express from "express";
import uniqid from "uniqid";
import fs from "fs";
import cors from "cors";
import { GPTScript, RunEventType } from "@gptscript-ai/gptscript";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";

// Setting express server
const app = express();
app.use(cors());
app.use(express.static("stories"));

// Variables
const gptScript = new GPTScript();
ffmpeg.setFfmpegPath(ffmpegPath);

// Create the stories
app.get("/create-story", async (req, res) => {
  const url = decodeURIComponent(req.query.url);
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

    return res.json(dir);
  } catch (error) {
    console.error(e);
    return res.json("error");
  }
});

// build the video
app.get("/build-video", async (req, res) => {
  const id = req.query.id;
  if (!id) {
    res.json("error invalid id");
  }
  const dir = "./story-data/" + id;

  if (!fs.existsSync(dir + "/1.png")) {
    // rename images
    fs.renameSync(dir + "/b-roll-1.png", dir + "/1.png");
    fs.renameSync(dir + "/b-roll-2.png", dir + "/2.png");
    fs.renameSync(dir + "/b-roll-3.png", dir + "/3.png");

    // rename audio
    fs.renameSync(dir + "/voiceover-1.mp3", dir + "/1.mp3");
    fs.renameSync(dir + "/voiceover-2.mp3", dir + "/2.mp3");
    fs.renameSync(dir + "/voiceover-3.mp3", dir + "/3.mp3");

    // rename voiceovers
    fs.renameSync(dir + "/voiceover-1.txt", dir + "/transcription-1.json");
    fs.renameSync(dir + "/voiceover-2.txt", dir + "/transcription-2.json");
    fs.renameSync(dir + "/voiceover-3.txt", dir + "/transcription-3.json");
  }

  const images = ["1.png", "2.png", "3.png"];
  const audios = ["1.mp3", "2.mp3", "3.mp3"];
  const transcriptions = [
    "transcription-1.json",
    "transcription-2.json",
    "transcription-3.json",
  ];

  for (let l = 0; l < images.length; l++) {
    const inputImage = path.join(dir, images[l]);
    const inputAudio = path.join(dir, audios[l]);
    const inputTranscription = path.join(dir, transcriptions[l]);
    const outputVideo = path.join(dir, `output_${l}.mp4`);

    // Read the transcription file
    const transcription = JSON.parse(
      fs.readFileSync(inputTranscription, "utf-8")
    );
    const words = transcription.words;
    const duration = parseFloat(transcription.duration).toFixed(2);

    // Build the drawtext filter string

    let drawtextFilter = "";

    words.forEach((wordInfo) => {
      const word = wordInfo.word.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const start = parseFloat(wordInfo.start).toFixed(2);
      const end = parseFloat(wordInfo.end).toFixed(2);

      drawtextFilter += `drawtext=text='${word}':fontcolor=white:fontsize=96:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h*3/4)-text_h:enable='between(t\\,${start}\\,${end})',`;
    });

    // Remove the last comma
    drawtextFilter = drawtextFilter.slice(0, -1);

    // ffmpeg create
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputImage)
        .loop(duration)
        .input(inputAudio)
        .audioCodec("copy")
        .videoFilter(drawtextFilter)
        .outputOption("-t", duration)
        .on("error", reject)
        .on("end", resolve)
        .save(outputVideo);
    });
  }

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(dir, "output_0.mp4"))
      .input(path.join(dir, "output_1.mp4"))
      .input(path.join(dir, "output_2.mp4"))
      .on("end", resolve)
      .on("error", reject)
      .mergeToFile(path.join(dir, "final.mp4"));
  });

  return res.json(`${id}/final.mp4`);
});

// App listinig on localhost:8888
app.listen(8888, () => console.log("Server is going on port 3000"));
