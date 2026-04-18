import { getYouTubeTranscript } from "../lib/youtube-transcript";

async function main() {
  const urls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Rick Astley (captions manuais)
    "https://www.youtube.com/watch?v=jNQXAC9IVRw", // Me at the zoo (só ASR — antes falhava)
    "https://www.youtube.com/watch?v=kxopViU98Xo", // Ted talk
  ];

  for (const u of urls) {
    try {
      const t = await getYouTubeTranscript(u);
      console.log(`\n=== ${u} ===\n${t.slice(0, 400)}\n...(total ${t.length} chars)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`\n=== ${u} ===\nERROR: ${msg}`);
    }
  }
}

main();
