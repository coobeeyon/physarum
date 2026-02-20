#!/usr/bin/env bun
/**
 * Formats Claude Code stream-json output for human reading.
 * Usage: ./scripts/run-reflect.sh 2>&1 | bun scripts/reflect-stream-fmt.ts
 */
export {}

const DIM = "\x1b[2m"
const BOLD = "\x1b[1m"
const CYAN = "\x1b[36m"
const YELLOW = "\x1b[33m"
const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const RESET = "\x1b[0m"

const truncate = (s: string, max: number): string =>
	s.length <= max ? s : `${s.slice(0, max)}...`

const formatEvent = (line: string): string | null => {
	let event: Record<string, unknown>
	try {
		event = JSON.parse(line)
	} catch {
		// Not JSON — pass through as-is (e.g. docker build output)
		return line
	}

	const type = event.type as string

	if (type === "system" && event.subtype === "init") {
		const model = (event as Record<string, unknown>).model as string
		return `${BOLD}${CYAN}[init]${RESET} model=${model}`
	}

	if (type === "assistant") {
		const msg = event.message as Record<string, unknown>
		const content = msg?.content as Array<Record<string, unknown>>
		if (!content) return null

		const parts: string[] = []
		for (const block of content) {
			if (block.type === "thinking") {
				const thinking = block.thinking as string
				if (thinking) {
					const firstLine = thinking.split("\n")[0]
					parts.push(`${DIM}[think] ${truncate(firstLine, 120)}${RESET}`)
				}
			} else if (block.type === "tool_use") {
				const name = block.name as string
				const input = block.input as Record<string, unknown>
				if (name === "Bash") {
					parts.push(
						`${YELLOW}[${name}]${RESET} ${input.command as string}`,
					)
				} else if (name === "Read") {
					parts.push(
						`${YELLOW}[${name}]${RESET} ${input.file_path as string}`,
					)
				} else if (name === "Edit") {
					parts.push(
						`${YELLOW}[${name}]${RESET} ${input.file_path as string}`,
					)
				} else if (name === "Write") {
					parts.push(
						`${YELLOW}[${name}]${RESET} ${input.file_path as string}`,
					)
				} else if (name === "Grep") {
					parts.push(
						`${YELLOW}[${name}]${RESET} /${input.pattern as string}/`,
					)
				} else if (name === "Glob") {
					parts.push(
						`${YELLOW}[${name}]${RESET} ${input.pattern as string}`,
					)
				} else {
					parts.push(
						`${YELLOW}[${name}]${RESET} ${truncate(JSON.stringify(input), 100)}`,
					)
				}
			} else if (block.type === "text") {
				parts.push(`${GREEN}[text]${RESET} ${truncate(block.text as string, 200)}`)
			}
		}
		return parts.length > 0 ? parts.join("\n") : null
	}

	if (type === "user") {
		const msg = event.message as Record<string, unknown>
		const content = msg?.content as Array<Record<string, unknown>>
		if (!content) return null

		for (const block of content) {
			if (block.type === "tool_result") {
				const raw = block.content
				const result = typeof raw === "string" ? raw : JSON.stringify(raw)
				if (block.is_error) {
					return `${RED}[error]${RESET} ${truncate(result, 200)}`
				}
				if (result) {
					const lines = result.split("\n")
					const preview =
						lines.length <= 3
							? result
							: `${lines.slice(0, 3).join("\n")}  ${DIM}(${lines.length} lines)${RESET}`
					return `${DIM}[result] ${truncate(preview, 200)}${RESET}`
				}
			}
		}
		return null
	}

	if (type === "result") {
		const result = event.result as string
		const cost = event.total_cost_usd as number
		const turns = event.num_turns as number
		return `\n${BOLD}${GREEN}[done]${RESET} turns=${turns} cost=$${cost?.toFixed(4) ?? "?"}\n${result ? truncate(result, 500) : "(no summary)"}`
	}

	return null
}

const decoder = new TextDecoder()
const reader = Bun.stdin.stream().getReader()
let buffer = ""

while (true) {
	const { done, value } = await reader.read()
	if (done) break

	buffer += decoder.decode(value, { stream: true })
	const lines = buffer.split("\n")
	buffer = lines.pop() ?? ""

	for (const line of lines) {
		if (!line.trim()) continue
		const formatted = formatEvent(line.trim())
		if (formatted) console.log(formatted)
	}
}

// Flush remaining buffer
if (buffer.trim()) {
	const formatted = formatEvent(buffer.trim())
	if (formatted) console.log(formatted)
}
