"""
Quick test for the /voice WebSocket endpoint.

Install extra deps first (not in main requirements):
  pip install sounddevice numpy websockets

Usage:
  python test_voice.py

Controls:
  Press ENTER to stop recording and send your turn.
  The agent response will be spoken back through your speakers.
  Type Ctrl+C to quit at any time.
"""

import asyncio
import json
import queue
import sys
import threading

try:
    import numpy as np
    import sounddevice as sd
    import websockets
except ImportError:
    sys.exit("Missing deps. Run:\n  pip install sounddevice numpy websockets")

WS_URL = "ws://localhost:8000/voice"
SAMPLE_RATE = 24000   # must match voice.py pcm_24000 / STT expected 24 kHz
CHANNELS = 1
DTYPE = "int16"
CHUNK = 1920  # 80 ms at 24 kHz — matches Gradium STT chunk size


async def run():
    print(f"Connecting to {WS_URL} …")
    async with websockets.connect(WS_URL) as ws:
        print("Connected.\n")

        loop = asyncio.get_event_loop()
        audio_q: queue.Queue[bytes] = queue.Queue()
        playback_q: asyncio.Queue = asyncio.Queue()
        recording_active = threading.Event()
        call_done = asyncio.Event()
        # Set once SD has finished playing the last TTS response.
        # record_and_send waits on this before starting the mic.
        tts_played = asyncio.Event()

        def _on_audio(indata, frames, time_info, status):  # noqa: ARG001
            if recording_active.is_set():
                audio_q.put(indata.copy().tobytes())

        # ── receive loop ────────────────────────────────────────────────────
        async def receive():
            try:
                async for message in ws:
                    if isinstance(message, bytes):
                        await playback_q.put(message)
                        continue

                    msg = json.loads(message)
                    t = msg.get("type")

                    if t == "transcript":
                        print(f"[You]   {msg['text']}")
                    elif t == "agent_text":
                        print(f"[Buena] {msg['text']}")
                    elif t == "tts_done":
                        await playback_q.put(None)  # sentinel: flush & play
                    elif t == "call_complete":
                        print("\n--- call complete ---")
                        call_done.set()
                        tts_played.set()
                        return
                    elif t == "error":
                        print(f"[ERROR] {msg.get('message')}")
                        call_done.set()
                        tts_played.set()
                        return
            except websockets.exceptions.ConnectionClosed:
                call_done.set()
                tts_played.set()

        # ── playback loop ────────────────────────────────────────────────────
        async def play_audio():
            pcm_buf = bytearray()
            while not call_done.is_set():
                try:
                    chunk = await asyncio.wait_for(playback_q.get(), timeout=0.2)
                except asyncio.TimeoutError:
                    continue

                if chunk is None:
                    if pcm_buf:
                        arr = np.frombuffer(bytes(pcm_buf), dtype=np.int16)
                        print(f"  [playing {len(arr)/SAMPLE_RATE:.1f}s of audio]")
                        # blocking play in executor so the event loop stays free
                        await loop.run_in_executor(
                            None,
                            lambda a=arr: sd.play(a, samplerate=SAMPLE_RATE, blocking=True),
                        )
                        pcm_buf.clear()
                    tts_played.set()  # signal AFTER sd.play() returns
                else:
                    pcm_buf.extend(chunk)

        # ── record + send loop ───────────────────────────────────────────────
        async def record_and_send():
            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype=DTYPE,
                blocksize=CHUNK,
                callback=_on_audio,
            ):
                while not call_done.is_set():
                    # Wait for current TTS to finish playing before opening mic
                    tts_played.clear()
                    await tts_played.wait()
                    if call_done.is_set():
                        return

                    # Drain audio captured during TTS playback
                    while not audio_q.empty():
                        try:
                            audio_q.get_nowait()
                        except queue.Empty:
                            break

                    recording_active.set()
                    print("\nRecording … (press ENTER when done speaking)")
                    await loop.run_in_executor(None, input)
                    recording_active.clear()

                    if call_done.is_set():
                        return

                    chunks: list[bytes] = []
                    while not audio_q.empty():
                        try:
                            chunks.append(audio_q.get_nowait())
                        except queue.Empty:
                            break

                    if not chunks:
                        print("(nothing recorded, try again)")
                        tts_played.set()  # skip the wait on next iteration
                        continue

                    for c in chunks:
                        await ws.send(c)
                    await ws.send(json.dumps({"type": "end_turn"}))
                    print("(processing …)\n")

        try:
            await asyncio.gather(receive(), play_audio(), record_and_send())
        except Exception as exc:
            print(f"[FATAL] {exc}")


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nBye.")
