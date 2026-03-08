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
        "description": description,
        "status": status,
    }
    if url:
        payload["url"] = url
    emit(payload)


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
    browser_profile = BrowserProfile(headless=headless)

    async def execute():
        emit_step(1, "Launching local browser session", "running", url)

        agent = Agent(
            task=full_task,
            llm=llm,
            browser_profile=browser_profile,
            use_vision=True,
            max_actions_per_step=5,
            step_timeout=min(timeout, 180),
            directly_open_url=True,
        )

        return await agent.run(max_steps=20)

    try:
        history = await asyncio.wait_for(execute(), timeout=timeout)

        if hasattr(history, "history") and history.history:
            for index, item in enumerate(history.history, start=1):
                description = "Step completed"
                if hasattr(item, "model_output") and item.model_output:
                    state = getattr(item.model_output, "current_state", None)
                    if hasattr(state, "next_goal"):
                        description = state.next_goal
                    elif isinstance(state, dict) and "next_goal" in state:
                        description = state["next_goal"]

                step = {
                    "number": index,
                    "description": description[:120],
                    "status": "passed",
                }
                steps.append(step)
                emit_step(index, step["description"], "passed")

        final_result = "Task completed"
        if hasattr(history, "final_result"):
          value = history.final_result() if callable(history.final_result) else history.final_result
          if value:
              final_result = str(value)

        status = "passed"
        lowered = final_result.lower()
        if any(token in lowered for token in ["fail", "error", "could not", "unable", "not found"]):
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
