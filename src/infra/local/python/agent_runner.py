#!/usr/bin/env python3
import asyncio
import json
import os


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
    full_task = f"""You are a QA testing agent. Verify whether the following criteria pass or fail.

Navigate to {url} and verify:

{task}

Rules:
- Verify outcomes, not just navigation.
- If expected UI or behavior is missing, fail the test.
- If the target URL or authentication fails, stop and report failure.
- Do not guess alternative URLs or hidden paths.
"""

    steps = []
    streamed_step_numbers = set()
    browser_profile = BrowserProfile(headless=headless)

    async def execute():
        emit_step(1, "Launching local browser session", "running", url)
        streamed_step_numbers.add(1)

        def on_new_step(browser_state_summary, model_output, step_number):
            next_goal = getattr(model_output, "next_goal", None) or "Agent step"
            evaluation = getattr(model_output, "evaluation_previous_goal", None)
            action_summary = None

            actions = getattr(model_output, "action", None) or []
            if actions:
                action_summary = "; ".join(filter(None, [summarize_action(action) for action in actions[:2]]))

            current_url = getattr(browser_state_summary, "url", None)
            emitted_step_number = step_number + 1
            streamed_step_numbers.add(emitted_step_number)

            emit_agent_step(
                emitted_step_number,
                next_goal[:140],
                "running",
                current_url,
                action_summary[:180] if action_summary else None,
                evaluation[:180] if evaluation else None,
            )

        agent = Agent(
            task=full_task,
            llm=llm,
            browser_profile=browser_profile,
            use_vision=True,
            max_actions_per_step=5,
            step_timeout=min(timeout, 180),
            directly_open_url=True,
            register_new_step_callback=on_new_step,
        )

        return await agent.run(max_steps=20)

    try:
        history = await asyncio.wait_for(execute(), timeout=timeout)

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
                    "title": description[:120],
                    "status": "passed",
                }
                steps.append(step)
                emit_agent_step(index, step["title"], "passed")

        final_result = "Task completed"
        if hasattr(history, "final_result"):
          value = history.final_result() if callable(history.final_result) else history.final_result
          if value:
              final_result = str(value)

        status = "passed"
        if hasattr(history, "is_successful"):
            success = history.is_successful() if callable(history.is_successful) else history.is_successful
            if success is False:
                status = "failed"
            elif success is True:
                status = "passed"
            else:
                lowered = final_result.lower()
                if any(token in lowered for token in ["error", "could not", "unable"]):
                    status = "failed"
        else:
            lowered = final_result.lower()
            if any(token in lowered for token in ["error", "could not", "unable"]):
                status = "failed"

        emit(
            {
                "type": "result",
                "status": status,
                "result": final_result,
                "error": final_result if status == "failed" else None,
                "steps": steps,
            }
        )
    except asyncio.TimeoutError:
        emit(
            {
                "type": "result",
                "status": "failed",
                "result": "Test timed out",
                "error": f"Test exceeded {timeout}s timeout",
                "steps": steps,
            }
        )
    except Exception as error:
        emit(
            {
                "type": "result",
                "status": "failed",
                "result": "Test failed with error",
                "error": f"{type(error).__name__}: {str(error)}",
                "steps": steps,
            }
        )


if __name__ == "__main__":
    asyncio.run(run_test())
