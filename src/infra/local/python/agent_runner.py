#!/usr/bin/env python3
import asyncio
import json
import os
import re


def emit(payload):
    print(json.dumps(payload), flush=True)


def emit_step(number, description, status="running", url=None):
    payload = {
        "type": "step",
        "step": number,
        "title": description,
        "status": status,
    }
    if url:
        payload["url"] = url
    emit(payload)


def emit_agent_step(number, title, status="running", url=None, action=None, observation=None):
    payload = {
        "type": "step",
        "step": number,
        "title": title,
        "status": status,
    }
    if url:
        payload["url"] = url
    if action:
        payload["action"] = action
    if observation:
        payload["observation"] = observation
    emit(payload)


def normalize_text(value):
    return " ".join(str(value or "").strip().split())


def summarize_action(action):
    if action is None:
        return None

    try:
        if hasattr(action, "model_dump"):
            dumped = action.model_dump(exclude_none=True)
        elif hasattr(action, "dict"):
            dumped = action.dict(exclude_none=True)
        else:
            dumped = action

        if isinstance(dumped, dict) and dumped:
            key = next(iter(dumped.keys()))
            value = dumped[key]
            if isinstance(value, dict) and value:
                details = ", ".join(f"{k}={v}" for k, v in value.items())
                return f"{key}({details})"
            return str(key)

        return str(dumped)
    except Exception:
        return str(action)


def compact_sentence(text, fallback, limit=120):
    normalized = normalize_text(text)
    if not normalized:
        return fallback

    first_sentence = re.split(r"(?<=[.!?])\s+", normalized, maxsplit=1)[0].strip()
    compact = first_sentence or normalized
    if len(compact) > limit:
        compact = compact[: limit - 1].rstrip() + "…"
    return compact


def summarize_step_title(title, action_summary=None):
    normalized = normalize_text(title)
    lowered = normalized.lower()

    if not normalized:
        return "Running check"

    if action_summary:
        action_lower = action_summary.lower()
        if action_lower.startswith("click("):
            if "pricing" in lowered:
                return "Open pricing page"
            if "sign in" in lowered or "login" in lowered:
                return "Open sign-in page"
            if "waitlist" in lowered:
                return "Open waitlist flow"
            return "Open requested page"
        if action_lower.startswith("find_text("):
            quoted = re.search(r"(?:text=)([^,)]+)", action_summary)
            if quoted:
                term = quoted.group(1).strip().strip("'").strip('"')
                return f"Check {term}"
            return "Check page text"
        if action_lower.startswith("evaluate("):
            return "Run page check"
        if action_lower.startswith("done("):
            return "Finish verification"

    normalized = re.sub(r"^verify (the presence of|presence of|that)\s+", "Check ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^confirm (programmatically )?that\s+", "Confirm ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^run an in-page check to confirm\s+", "Check ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^click (on )?", "Open ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^finish verification.*$", "Finish verification", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^no further actions required.*$", "Finish verification", normalized, flags=re.IGNORECASE)

    return compact_sentence(normalized, "Running check", limit=78)


def summarize_observation(observation):
    if not observation:
        return None

    normalized = normalize_text(observation)
    normalized = re.sub(r"^no previous explicit action to evaluate;\s*", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^status:\s*", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^verification step completed:\s*", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^pricing page loaded;\s*", "Pricing page loaded; ", normalized, flags=re.IGNORECASE)

    return compact_sentence(normalized, "", limit=110) or None


def normalize_step_key(title, observation, url):
    return (
        normalize_text(title).lower(),
        normalize_text(observation).lower(),
        normalize_text(url).lower(),
    )


def classify_failure_kind(text):
    lowered = normalize_text(text).lower()

    if any(token in lowered for token in ["timeout", "timed out", "exceeded"]):
        return "timeout"

    if any(
        token in lowered
        for token in [
            "not found",
            "missing",
            "not present",
            "could not find",
            "unable to verify",
            "did not",
            "expected",
            "remained on",
            "assert",
            "failed as expected",
        ]
    ):
        return "assertion"

    return "runtime"


def is_simple_verification(task: str) -> bool:
    normalized = " ".join(task.lower().strip().split())
    if not normalized:
        return False

    simple_starts = (
        "verify ",
        "check ",
        "confirm ",
        "make sure ",
        "ensure ",
    )

    broad_audit_terms = (
        "all ",
        "every ",
        "full ",
        "complete ",
        "entire ",
        "comprehensive ",
        "extract ",
        "all pricing",
        "all text",
    )

    return (
        normalized.startswith(simple_starts)
        and len(normalized) <= 140
        and not any(term in normalized for term in broad_audit_terms)
    )


def build_task_prompt(url: str, task: str, simple_verification: bool) -> str:
    if simple_verification:
        return f"""You are a QA verification agent.

Navigate to {url} and verify this request:

{task}

Rules:
- Use the fewest steps needed.
- Prefer one clear URL check and one strong visible page marker.
- Use built-in navigation and text checks before any heavier page inspection.
- Stop immediately once the request is clearly verified.
- Do not verify the same condition twice.
- Once the URL or marker is confirmed, immediately finish with a concise pass/fail result.
- Do not broaden the task into a full page audit.
- Do not extract large amounts of page content unless the request explicitly asks for it.
- Avoid extract() unless the request explicitly asks for extracted content.
- Avoid evaluate() unless a direct text or URL check cannot answer the request.
- If the expected page or behavior is missing, fail clearly.
- Do not guess alternative URLs or hidden paths.
"""

    return f"""You are a QA testing agent. Verify whether the following criteria pass or fail.

Navigate to {url} and verify:

{task}

Rules:
- Verify outcomes, not just navigation.
- If expected UI or behavior is missing, fail the test.
- If the target URL or authentication fails, stop and report failure.
- Do not guess alternative URLs or hidden paths.
- Stop when the requested criteria are fully verified.
"""


def compact_result_text(result: str, task: str, status: str, simple_verification: bool) -> str:
    if not result:
        return "Verification completed." if status == "passed" else "Verification failed."

    normalized = " ".join(result.split())
    if not simple_verification:
        return normalized

    if status == "passed":
        lowered = normalized.lower()

        url_match = re.search(r"(/[a-z0-9/_-]+)", normalized, re.IGNORECASE)
        marker_match = re.search(r"'([^']{2,80})'", normalized)

        parts = []
        if url_match:
            parts.append(f"confirmed {url_match.group(1)}")
        if marker_match:
            parts.append(f'found "{marker_match.group(1)}"')

        if parts:
            return "Verified: " + " and ".join(parts) + "."

        return f"Verified: {task.rstrip('.')}."

    first_sentence = normalized.split(".")[0].strip()
    if first_sentence:
        return first_sentence + "."
    return "Verification failed."


def build_result_summary(status, failure_kind, compact_result, last_progress=None):
    progress = normalize_text(last_progress or "")

    if status == "passed":
        return compact_result

    if failure_kind == "cancelled":
        if progress:
            return f"Run cancelled after: {progress}"
        return "Run cancelled before verification completed."

    if failure_kind == "timeout":
        if progress:
            return f"Run timed out before completion. Last progress: {progress}"
        return "Run timed out before the requested check completed."

    if failure_kind == "assertion":
        if progress:
            return f"Requested check failed. Last progress: {progress}"
        return compact_result or "Requested check failed."

    if progress:
        return f"Run failed due to a runtime issue. Last progress: {progress}"
    return compact_result or "Run failed due to a runtime issue."


async def capture_final_screenshot(agent, history=None):
    try:
        if history and hasattr(history, "screenshots"):
            screenshots = history.screenshots(return_none_if_not_screenshot=False)
            if screenshots:
                return screenshots[-1]

        if not getattr(agent, "browser_session", None):
            return None

        return await agent.browser_session.take_screenshot(full_page=False)
    except Exception:
        return None


async def run_test():
    from browser_use import Agent, BrowserProfile
    from llm_proxy import get_llm

    url = os.environ.get("QARMA_URL", "")
    task = os.environ.get("QARMA_TASK", "")
    timeout = int(os.environ.get("QARMA_TIMEOUT", "60"))
    headless = os.environ.get("QARMA_HEADLESS", "true").lower() == "true"

    if not url or not task:
        emit(
            {
                "type": "result",
                "status": "failed",
                "result": "Missing URL or task",
                "error": "QARMA_URL and QARMA_TASK are required",
                "steps": [],
            }
        )
        return

    llm = get_llm()
    simple_verification = is_simple_verification(task)
    full_task = build_task_prompt(url, task, simple_verification)
    max_steps = 5 if simple_verification else 20
    max_actions_per_step = 2 if simple_verification else 5

    steps = []
    streamed_step_numbers = set()
    streamed_step_keys = set()
    last_progress_summary = ""
    browser_profile = BrowserProfile(headless=headless)
    agent = None

    async def execute():
        nonlocal agent
        emit_step(1, "Launching local browser session", "running", url)
        streamed_step_numbers.add(1)

        def on_new_step(browser_state_summary, model_output, step_number):
            nonlocal last_progress_summary
            next_goal = getattr(model_output, "next_goal", None) or "Agent step"
            evaluation = getattr(model_output, "evaluation_previous_goal", None)
            action_summary = None

            actions = getattr(model_output, "action", None) or []
            if actions:
                action_summary = "; ".join(filter(None, [summarize_action(action) for action in actions[:2]]))

            current_url = getattr(browser_state_summary, "url", None)
            emitted_step_number = step_number + 1
            step_title = summarize_step_title(next_goal, action_summary)
            step_observation = summarize_observation(evaluation)
            step_key = normalize_step_key(step_title, step_observation, current_url)

            if step_key in streamed_step_keys:
                return

            streamed_step_numbers.add(emitted_step_number)
            streamed_step_keys.add(step_key)
            last_progress_summary = step_observation or step_title

            emit_agent_step(
                emitted_step_number,
                step_title,
                "running",
                current_url,
                action_summary[:180] if action_summary else None,
                step_observation,
            )

        agent = Agent(
            task=full_task,
            llm=llm,
            browser_profile=browser_profile,
            use_vision=not simple_verification,
            max_actions_per_step=max_actions_per_step,
            step_timeout=min(45 if simple_verification else 90, timeout),
            directly_open_url=True,
            register_new_step_callback=on_new_step,
        )

        return await agent.run(max_steps=max_steps)

    try:
        history = await asyncio.wait_for(execute(), timeout=timeout)
        final_screenshot = await capture_final_screenshot(agent, history)

        if hasattr(history, "history") and history.history:
            for index, item in enumerate(history.history, start=1):
                if index in streamed_step_numbers:
                    continue

                description = "Step completed"
                if hasattr(item, "model_output") and item.model_output:
                    state = getattr(item.model_output, "current_state", None)
                    if hasattr(state, "next_goal"):
                        description = state.next_goal
                    elif isinstance(state, dict) and "next_goal" in state:
                        description = state["next_goal"]

                step = {
                    "number": index,
                    "title": summarize_step_title(description),
                    "status": "passed",
                }
                steps.append(step)
                emit_agent_step(index, step["title"], "passed")
                if not last_progress_summary:
                    last_progress_summary = step["title"]

        final_result = "Task completed"
        if hasattr(history, "final_result"):
          value = history.final_result() if callable(history.final_result) else history.final_result
          if value:
              final_result = str(value)

        status = "passed"
        failure_kind = None
        if hasattr(history, "is_successful"):
            success = history.is_successful() if callable(history.is_successful) else history.is_successful
            if success is False:
                status = "failed"
                failure_kind = classify_failure_kind(final_result)
            elif success is True:
                status = "passed"
            else:
                lowered = final_result.lower()
                if any(token in lowered for token in ["error", "could not", "unable"]):
                    status = "failed"
                    failure_kind = classify_failure_kind(final_result)
        else:
            lowered = final_result.lower()
            if any(token in lowered for token in ["error", "could not", "unable"]):
                status = "failed"
                failure_kind = classify_failure_kind(final_result)

        compact_result = compact_result_text(final_result, task, status, simple_verification)
        summary_result = build_result_summary(
            status,
            failure_kind,
            compact_result,
            last_progress_summary,
        )

        emit(
            {
                "type": "result",
                "status": status,
                "result": summary_result,
                "error": summary_result if status == "failed" else None,
                "error_kind": failure_kind,
                "screenshot": final_screenshot,
                "steps": steps,
            }
        )
    except asyncio.TimeoutError:
        timeout_result = build_result_summary(
            "failed",
            "timeout",
            f"Run timed out after {timeout}s.",
            last_progress_summary,
        )
        emit(
            {
                "type": "result",
                "status": "failed",
                "result": timeout_result,
                "error": f"Test exceeded {timeout}s timeout",
                "error_kind": "timeout",
                "steps": steps,
            }
        )
    except Exception as error:
        emit(
            {
                "type": "result",
                "status": "failed",
                "result": "Run failed with a runtime error.",
                "error": f"{type(error).__name__}: {str(error)}",
                "error_kind": "runtime",
                "steps": steps,
            }
        )


if __name__ == "__main__":
    asyncio.run(run_test())
