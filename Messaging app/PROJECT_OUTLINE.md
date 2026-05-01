# Spectrum Messaging — Project Outline

## Concept

A private messaging application that encodes messages as pixel images using a per-conversation colour mapping, built on top of the Spectrum Algo encoding format. Messages in transit look like abstract colour images — not encrypted data, not readable text, just pictures. Surveillance systems scanning for text patterns or known encryption fingerprints see nothing recognisable.

This is not encryption in the traditional sense. It is **format obscurity backed by a cryptographically strong per-conversation key**, expressed entirely in colour.

---

## The Core Problem It Solves

Governments (notably the UK via the Online Safety Act 2023) are pushing for client-side scanning of messages — compelling platforms to read content before it is sent. Traditional end-to-end encryption is under legal pressure because it is identifiable *as* encryption.

Spectrum Messaging sidesteps this at the format level. A scanned message is not ciphertext — it is an image file. There is no text to scan, no known encryption pattern to flag, no standard steganographic signature to detect.

---

## How It Works

### 1. Seed Exchange (One Time Per Conversation)
When two users begin a conversation, they establish a shared **seed** — this could be:
- A specific colour value (e.g. a hex code)
- A shared image (e.g. any photo exchanged out-of-band)
- A generated value exchanged via a Diffie-Hellman style handshake

The seed never travels with the messages. It is stored locally on each device.

### 2. Palette Derivation
Both devices feed the seed through a deterministic algorithm to generate a **colour mapping table** — a unique lookup that assigns colours to characters/byte values. This mapping is the conversation's key.

Every conversation produces a different mapping:
- In conversation A: `#3A7FCC` (a shade of blue) = `H`
- In conversation B: `#3A7FCC` = `f`

Without the mapping, the image conveys nothing.

### 3. Message Encoding
When a message is sent:
1. The text is looked up character by character against the colour mapping
2. Each character becomes a coloured pixel
3. The pixels are arranged into an image
4. That image is sent as the message

### 4. Message Decoding
On receipt:
1. The image is received
2. Each pixel's colour is looked up against the same locally-stored colour mapping
3. Characters are reconstructed in order
4. The original message is displayed

To any outside observer — including automated scanning systems — the message is just a colourful image.

---

## Key Properties

**Per-conversation uniqueness** — Each conversation has its own colour mapping. Breaking one conversation's key reveals nothing about any other conversation.

**Enormous keyspace** — With 256 colours mapping to 256 possible byte values, the number of possible mappings is 256! (factorial). This is not brute-forceable.

**No cryptographic fingerprint** — The output is a standard image file. It carries none of the structural signatures that identify encrypted data.

**Seed-as-image** — The key exchange itself can be visual. A shared photo becomes the seed that generates the entire colour mapping. The decoding key looks like a holiday snap.

**Plausible deniability** — There is no provable intent to obfuscate. Two people exchanged pictures. That's it.

---

## Reference Integrity (Inherited from Spectrum Algo)

Where the messaging app loads any supporting `.spec` encoded resources, a **runtime interception** layer handles decoding transparently:

- Files are stored as `.spec` (pixel-encoded)
- A runtime shim intercepts file requests and decodes on the fly
- Original filenames and internal references remain intact
- No OS-specific implementation required — interception happens at the ecosystem level (e.g. Service Worker for web, module loader hook for Node)

---

## Architecture (Proposed)

```
[Sender Device]
  Message text
    → Colour mapping lookup (per-conversation palette)
    → Pixel image generated
    → Image transmitted

[Network / Platform]
  Sees: an image file
  Cannot read: anything

[Receiver Device]
  Image received
    → Pixel colours extracted
    → Colour mapping lookup (same palette, stored locally)
    → Original message reconstructed
```

---

## Open Questions

- **Seed exchange UX** — How does the initial palette handshake feel to a non-technical user? QR code? Shared photo picker?
- **Palette storage** — Where and how are per-conversation mappings stored securely on-device?
- **Image format** — PNG is lossless and safe for pixel-perfect colour fidelity. JPEG compression would corrupt the mapping. Format must be enforced.
- **Colour precision** — How many distinct colours are needed? 256? More? What is the trade-off between palette size and image dimensions?
- **Group conversations** — How does the shared seed model extend to 3+ participants?
- **Key rotation** — Should the colour mapping change periodically within a long conversation?

---

## Phase Plan

| Phase | Goal |
|-------|------|
| 1 | Define colour mapping algorithm and palette derivation from seed |
| 2 | Encode/decode round-trip proof of concept (text → image → text) |
| 3 | Seed exchange mechanism (key handshake) |
| 4 | Basic messaging UI with encode/decode pipeline integrated |
| 5 | Per-conversation palette storage and management |
| 6 | Group conversation model |
| 7 | Hardening — image format enforcement, edge cases, error handling |

---

*Part of the Spectrum Algo project family.*
