from inference_sdk import InferenceHTTPClient

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="Y0UeO8RHs1Vp63Y6O3m3"
)

def run_roboflow_workflow(image_path: str):
    """
    Runs the Roboflow workflow on the given image.

    Args:
        image_path (str): Path to the image file.

    Returns:
        dict: Result of the workflow.
    """
    result = client.run_workflow(
        workspace_name="innovyom-1s6fe",
        workflow_id="detect-and-classify",
        images={"image": image_path},
        use_cache=True
    )
    return result
