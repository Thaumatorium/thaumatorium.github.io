"""
use this with `uv`:

$ uv run relative_code.py
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "matplotlib",
# ]
# ///

# Build and save the horizontal stacked barchart as SVG
import matplotlib.pyplot as plt

categories: list[str] = [
    "(ex-)Partner",
    "Ouder van slachtoffer",
    "Overig familie",
    "Kennis of vriend(in)",
    "Criminelen onderling",
    "Geen connectie",
    "Overig of onbekend",
    "Dader onbekend",
]

# Percentages from the original table
values_women_pct: list[float] = [56.3, 8.4, 11.2, 10.7, 0.5, 5.1, 3.7, 4.2]
values_men_pct: list[float] = [4.6, 4.1, 6.2, 29.5, 14.7, 16.1, 7.8, 16.8]

colors = plt.cm.tab20.colors  # color per category as requested

# Gestapelde horizontale barchart met percentages (geschaald naar 100%)
fig, ax = plt.subplots(figsize=(12, 7))

left = 0.0
for i, val in enumerate(values_men_pct):
    ax.barh("Mannen", val, left=left, color=colors[i], edgecolor="none")
    left += val

left = 0.0
for i, val in enumerate(values_women_pct):
    ax.barh("Vrouwen", val, left=left, color=colors[i], edgecolor="none")
    left += val

ax.set_xlabel("Percentage")
ax.set_xlim(0, 100)
ax.set_title("Relatie dader tot slachtoffer naar geslacht (percentages, 2017–2021)")
ax.legend(categories, bbox_to_anchor=(1.02, 1), loc="upper left", title="Categorie")
plt.tight_layout()

out_path = "./relatie-dader-slachtoffer-stacked-percent-2017-2021.svg"
plt.savefig(out_path, format="svg", bbox_inches="tight")
plt.close(fig)

out_path
