import { NODE_TYPE_PERSON, NODE_TYPE_GAME, CATEGORY_GAME1_ONLY, CATEGORY_GAME2_ONLY, CATEGORY_BOTH, CATEGORY_SINGLE_GAME } from "./config.js";

/**
 * Sets up event listeners on D3 nodes:
 * - Hover (`mouseenter`/`mouseleave`) to display/hide tooltips.
 * - Click (with Ctrl/Cmd) for highlighting shared roles (departments).
 *
 * @param {d3.Selection} nodeSelection - The D3 selection of node 'g' elements.
 * @param {HTMLElement} tooltipElement - The DOM element to use for the tooltip.
 * @param {Map<string, Set<string>>} personRolesMap - Map of person ID to their roles.
 * @param {SVGSVGElement} svgNode - The root SVG DOM element (for coordinate calculations).
 * @param {string | null} game1Name - The name of the first game being displayed.
 * @param {string | null} game2Name - The name of the second game (might be same as game1Name).
 * @param {boolean} isSingleGameView - Flag indicating if only one distinct game is shown.
 */
export function setupD3Tooltips(nodeSelection, tooltipElement, personRolesMap, svgNode, game1Name, game2Name, isSingleGameView) {
	if (!nodeSelection || !tooltipElement || !personRolesMap || !svgNode) {
		console.error("D3 Tooltip setup missing required arguments.");
		return;
	}

	const nodesGroup = d3.select(svgNode).select("g.nodes");
	const clearHighlights = () => {
		nodeSelection.classed("highlighted-department", false);
		if (nodesGroup) {
			nodesGroup.classed("department-highlight-active", false);
		}
	};
	const hideTooltipOnly = () => {
		tooltipElement.style.display = "none";
		tooltipElement.setAttribute("aria-hidden", "true");
		nodeSelection.classed("tooltip-active", false);
	};
	const hideTooltipAndHighlights = () => {
		hideTooltipOnly();
		clearHighlights();
	};
	const showTooltip = (d, screenPos) => {
		let htmlContent = `<strong>${d.name || "Unknown Node"}</strong>`;

		if (d.type) {
			const typeText = d.type.charAt(0).toUpperCase() + d.type.slice(1);
			htmlContent += ` (${typeText})`;
		}

		if (d.type === NODE_TYPE_PERSON) {
			let contributionText = "";
			if (isSingleGameView) {
				if (game1Name) contributionText = `Contributed to: ${game1Name}`;
			} else {
				switch (d.category) {
					case CATEGORY_GAME1_ONLY:
						if (game1Name) contributionText = `Contributed to: ${game1Name} (only)`;
						break;
					case CATEGORY_GAME2_ONLY:
						if (game2Name) contributionText = `Contributed to: ${game2Name} (only)`;
						break;
					case CATEGORY_BOTH:
						if (game1Name && game2Name) contributionText = `Contributed to: Both ${game1Name} & ${game2Name}`;
						else if (game1Name) contributionText = `Contributed to: ${game1Name}`;
						else if (game2Name) contributionText = `Contributed to: ${game2Name}`;
						break;
					default:
						break;
				}
			}
			if (contributionText) {
				htmlContent += `<br><span class="tooltip-info">${contributionText}</span>`;
			}

			const roles = personRolesMap.get(d.id);
			if (roles && roles.size > 0) {
				htmlContent += `<br><span class="tooltip-info">Role(s): ${[...roles].sort().join(", ")}</span>`;
			} else if (d.primaryRole) {
				htmlContent += `<br><span class="tooltip-info">Primary Role: ${d.primaryRole}</span>`;
			} else {
			}
		} else if (d.type === NODE_TYPE_GAME) {
			const contributorCount = d.degree || 0;
			htmlContent += `<br><span class="tooltip-info">Contributors shown: ${contributorCount}</span>`;
		}

		tooltipElement.innerHTML = htmlContent;
		tooltipElement.style.display = "block";
		tooltipElement.setAttribute("aria-hidden", "false");
		const tooltipPadding = 15;
		tooltipElement.style.left = `${screenPos[0] + tooltipPadding}px`;
		tooltipElement.style.top = `${screenPos[1] + tooltipPadding}px`;
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
		const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

		if (tooltipRect.right > viewportWidth - 10) {
			tooltipElement.style.left = `${screenPos[0] - tooltipRect.width - tooltipPadding}px`;
		}
		if (tooltipRect.bottom > viewportHeight - 10) {
			tooltipElement.style.top = `${screenPos[1] - tooltipRect.height - tooltipPadding}px`;
		}
		if (tooltipRect.left < 10) {
			tooltipElement.style.left = `${tooltipPadding}px`;
		}
		if (tooltipRect.top < 10) {
			tooltipElement.style.top = `${tooltipPadding}px`;
		}
	};
	nodeSelection.on("mouseenter", (event, d) => {
		const currentTargetNode = d3.select(event.currentTarget);
		const [screenX, screenY] = [event.clientX, event.clientY];
		showTooltip(d, [screenX, screenY]);
		currentTargetNode.classed("tooltip-active", true);
	});
	nodeSelection.on("mouseleave", (event, d) => {
		hideTooltipOnly();
	});
	nodeSelection.on("click", (event, d) => {
		event.stopPropagation();

		const isCtrlClick = event.ctrlKey || event.metaKey;

		if (isCtrlClick) {
			const currentTargetNode = d3.select(event.currentTarget);
			hideTooltipOnly();
			const wasAlreadyHighlighted = currentTargetNode.classed("highlighted-department");
			const wasHighlightActive = nodesGroup ? nodesGroup.classed("department-highlight-active") : false;

			clearHighlights();

			if (wasAlreadyHighlighted && wasHighlightActive) {
				return;
			}
			if (d.type === NODE_TYPE_PERSON) {
				const clickedRoles = personRolesMap.get(d.id);
				currentTargetNode.classed("highlighted-department", true);
				if (clickedRoles && clickedRoles.size > 0) {
					let matchCount = 0;
					nodeSelection
						.filter((_d) => {
							if (_d.type !== NODE_TYPE_PERSON || _d.id === d.id) return false;
							const otherRoles = personRolesMap.get(_d.id);
							if (!otherRoles || otherRoles.size === 0) return false;
							return [...clickedRoles].some((role) => otherRoles.has(role));
						})
						.classed("highlighted-department", true)
						.each(() => matchCount++);
				}
				if (nodesGroup) {
					nodesGroup.classed("department-highlight-active", true);
				}
			}
		}
	});
	d3.select(svgNode).on("click", (event) => {
		if (event.target === svgNode || event.target === zoomLayer.node() || event.target.classList.contains("zoom-layer")) {
			hideTooltipAndHighlights();
		}
	});
	d3.select("body").on("keydown", (event) => {
		if (event.key === "Escape") {
			hideTooltipAndHighlights();
		}
	});
}
