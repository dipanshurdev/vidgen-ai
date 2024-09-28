import express from "express";
import uniqid from "uniqid";
import fs from "fs";
import cors from "cors";
import { GPTScript, RunEventType } from "@gptscript-ai/gptscript";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Setting express server
const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.static("story-data"));

// Set the OpenAI API key from environment variable
const openAiKey = process.env.OPENAI_API_KEY;

// Initialize GPTScript with OpenAI API key
const gptScript = new GPTScript({
  apiKey: openAiKey, // Pass the API key to GPTScript
});

ffmpeg.setFfmpegPath(ffmpegPath);

// Create the stories
app.get("/create-story", async (req, res) => {
  const url = decodeURIComponent(req.query.url);
  const uniqueDir = uniqid(); // Renamed to avoid variable shadowing
  const storyPath = path.join("./story-data", uniqueDir); // Using `path.join` for platform safety
  fs.mkdirSync(storyPath, { recursive: true });

  try {
    const run = await gptScript.run("./read.gpt", {
      input: `--url ${url} --dir ${storyPath}`,
      disableCache: true,
    });

    run.on(RunEventType.Event, (e) => {
      if (e.type === RunEventType.CallFinish && e.output) {
        console.log(e.output);
      }
    });

    const results = await run.text();
    console.log("gpt script run: " + results);

    return res.json(uniqueDir);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error running GPTScript" });
  }
});

// Other routes...

app.listen(8888, () => console.log("Server is running on port 8888"));
