#!/usr/bin/env python3
import os


def get_llm():
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    access_token = os.environ.get("QARMA_ACCESS_TOKEN", "")
    api_url = os.environ.get("QARMA_API_URL", "")
    model_id = os.environ.get("QARMA_MODEL_ID", "gpt-4o-mini")

    if openai_key:
        from browser_use import ChatOpenAI

        return ChatOpenAI(
            model=model_id,
            api_key=openai_key,
            temperature=0.0,
        )

    if access_token and api_url:
        raise ValueError("Qarma-managed local inference is not wired to the Browser-Use model interface yet.")

    raise ValueError(
        "No LLM configuration found. Set OPENAI_API_KEY or provide QARMA_ACCESS_TOKEN and QARMA_API_URL."
    )
