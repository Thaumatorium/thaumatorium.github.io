from typing import Any
import pandas as pd
import json
from pathlib import Path

HERE = Path(__file__).parent


def load_json(file_path: Path) -> dict[str, Any]:
    """
    Load a JSON file and return its content as a dictionary.
    """
    with file_path.open() as file:
        return json.load(file)


def json_to_csv(json_data: dict, keys: list[str], csv_output_path: str) -> None:
    """
    Convert specified keys of a JSON dictionary to a CSV file.

    :param json_data: Dictionary containing the JSON data
    :param keys: List of keys to extract from the JSON data
    :param csv_output_path: Path to save the output CSV file
    """
    # Extract the specified keys from the JSON data
    extracted_data = {key: json_data[key] for key in keys if key in json_data}

    # Convert to DataFrame
    df = pd.DataFrame(extracted_data)

    # Save to CSV
    df.to_csv(csv_output_path, index=False)


# Example usage
if __name__ == "__main__":
    file_path = HERE / "wow_credits.json"
    csv_output_path = "wow_credits_output.csv"
    keys_to_extract = ["key1", "key2"]  # Replace with actual keys you want to extract

    json_data = load_json(file_path)
    json_to_csv(json_data, keys_to_extract, csv_output_path)
    print(f"CSV file has been saved to {csv_output_path}")
