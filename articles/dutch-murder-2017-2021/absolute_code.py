"""
use this with `uv`:

$ uv run absolute_code.py
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

total_women: int = 215
total_men: int = 434

# Convert to absolute counts
values_women_abs: list[float] = [v * total_women / 100 for v in values_women_pct]
values_men_abs: list[float] = [v * total_men / 100 for v in values_men_pct]

colors = plt.cm.tab20.colors  # color per category as requested

fig, ax = plt.subplots(figsize=(12, 7))

# Men stacked
left = 0.0
for i, val in enumerate(values_men_abs):
    ax.barh("Mannen", val, left=left, color=colors[i], edgecolor="none")
    left += val

# Women stacked
left = 0.0
for i, val in enumerate(values_women_abs):
    ax.barh("Vrouwen", val, left=left, color=colors[i], edgecolor="none")
    left += val

ax.set_xlabel("Aantal slachtoffers")
ax.set_title(
    "Relatie dader tot slachtoffer naar geslacht (absolute aantallen, 2017–2021)"
)
ax.legend(categories, bbox_to_anchor=(1.02, 1), loc="upper left", title="Categorie")
plt.tight_layout()

out_path: str = "./relatie-dader-slachtoffer-stacked-2017-2021.svg"
plt.savefig(out_path, format="svg", bbox_inches="tight")
plt.close(fig)

out_path
