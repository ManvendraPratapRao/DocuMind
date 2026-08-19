SYSTEM_PROMPT = """You are a precise data extraction engine. 
You ONLY output valid JSON matching the exact schema provided. 
Do not add any commentary, markdown formatting, or explanations.
If a field cannot be determined from the document, set its value to null.
"""

def build_extraction_prompt(doc_type: str, schema_json: str, document_text: str) -> str:
    """Builds the main extraction prompt for the LLM."""
    return f"""Extract data from the following {doc_type} document.
    
Your output MUST be a valid JSON object adhering strictly to this JSON schema:
{schema_json}

Here is the document text:
-------------------------
{document_text}
-------------------------
"""

def build_correction_prompt(previous_output: str, validation_errors: str) -> str:
    """Builds a prompt asking the LLM to fix its previous output."""
    return f"""Your previous output failed validation. 
Fix the following JSON so it strictly adheres to the schema.

Validation Errors:
{validation_errors}

Previous Output:
{previous_output}
"""

def build_partial_prompt(doc_type: str, schema_json: str, document_text: str) -> str:
    """Builds a simplified prompt for the 3rd attempt, asking for partial data."""
    return f"""Extract whatever fields you can from this {doc_type} document.
Set any unknown or unclear fields to null. Do not guess.

Target JSON schema:
{schema_json}

Document text:
-------------------------
{document_text}
-------------------------
"""