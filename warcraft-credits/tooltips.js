import { NODE_TYPE_PERSON, NODE_TYPE_GAME, CATEGORY_GAME1_ONLY, CATEGORY_GAME2_ONLY, CATEGORY_BOTH, CATEGORY_SINGLE_GAME } from "./config.js";

/**
 * Sets up event listeners on D3 nodes.
 * Uses absolute positioning relative to the SVG container's coordinate space.
 * Positions tooltip primarily to the upper-right of the cursor.
 * Assumes the SVG container or an ancestor has position: relative.
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

	// Get the closest positioned ancestor (or null if none)
	// We assume the SVG or its container is the intended context
	const positioningContextElement = tooltipElement.offsetParent || document.body;

	const nodesGroup = d3.select(svgNode).select("g.nodes");
	const zoomLayer = d3.select(svgNode).select("g.zoom-layer");

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

	const showTooltip = (d, event) => {
		// Pass the whole event object
		const clientX = event.clientX;
		const clientY = event.clientY;

		let htmlContent = `<strong>${d.name || "Unknown Node"}</strong>`;
		if (d.type) {
			htmlContent += ` (${d.type.charAt(0).toUpperCase() + d.type.slice(1)})`;
		}
		if (d.type === NODE_TYPE_PERSON) {
			let contributionText = "";
			if (isSingleGameView) {
				if (game1Name) contributionText = `Contributed to: ${game1Name}`;
			} else {
				switch (d.category) {
					case CATEGORY_GAME1_ONLY:
						contributionText = `Contributed to: ${game1Name} (only)`;
						break;
					case CATEGORY_GAME2_ONLY:
						contributionText = `Contributed to: ${game2Name} (only)`;
						break;
					case CATEGORY_BOTH:
						contributionText = `Contributed to: Both ${game1Name} & ${game2Name}`;
						break;
					default:
						contributionText = `Contribution status: ${d.category || "Unknown"}`;
						break;
				}
			}
			if (contributionText) htmlContent += `<br><span class="tooltip-info">${contributionText}</span>`;
			const roles = personRolesMap.get(d.id);
			if (roles && roles.size > 0) {
				htmlContent += `<br><span class="tooltip-info">Role(s): ${[...roles].sort().join(", ")}</span>`;
			} else if (d.primaryRole) {
				htmlContent += `<br><span class="tooltip-info">Primary Role: ${d.primaryRole}</span>`;
			}
		} else if (d.type === NODE_TYPE_GAME) {
			const contributorCount = d.degree || 0;
			htmlContent += `<br><span class="tooltip-info">Contributors shown: ${contributorCount}</span>`;
		}

		tooltipElement.innerHTML = htmlContent;
		tooltipElement.style.display = "block";
		tooltipElement.setAttribute("aria-hidden", "false");
		tooltipElement.style.left = "-10000px";
		tooltipElement.style.top = "-10000px";
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const tooltipWidth = tooltipRect.width;
		const tooltipHeight = tooltipRect.height;
		const tooltipPadding = 15; // Original padding

		// Get the positioning context element's bounding rect
		const contextRect = positioningContextElement.getBoundingClientRect();
		const mouseXRelative = clientX - contextRect.left;
		const mouseYRelative = clientY - contextRect.top;

		let targetContextLeft = mouseXRelative + tooltipPadding;
		let targetContextTop = mouseYRelative - tooltipHeight - tooltipPadding; // Place T above cursor B

		const contextWidth = positioningContextElement.offsetWidth;
		const contextHeight = positioningContextElement.offsetHeight;
		const boundaryPadding = 10; // Min space from edge

		// Check Top Boundary: If too high, flip BELOW cursor
		if (targetContextTop < boundaryPadding) {
			targetContextTop = mouseYRelative + tooltipPadding;
		}

		// Check Right Boundary: If too far right, flip LEFT of cursor
		if (targetContextLeft + tooltipWidth > contextWidth - boundaryPadding) {
			targetContextLeft = mouseXRelative - tooltipWidth - tooltipPadding;
		}

		// Final Edge Adjustments (after potential flips)
		// Check Left Boundary: If still too far left (e.g., after flipping left), adjust right
		if (targetContextLeft < boundaryPadding) {
			targetContextLeft = boundaryPadding;
		}
		// Check Bottom Boundary: If still too low (e.g., after flipping below), adjust up
		if (targetContextTop + tooltipHeight > contextHeight - boundaryPadding) {
			targetContextTop = contextHeight - tooltipHeight - boundaryPadding;
			// Final safety check: if adjusting up pushed it above top, clamp to top
			if (targetContextTop < boundaryPadding) {
				targetContextTop = boundaryPadding;
			}
		}

		tooltipElement.style.left = `${targetContextLeft}px`;
		tooltipElement.style.top = `${targetContextTop}px`;
	};

	nodeSelection.on("mouseenter", (event, d) => {
		const currentTargetNode = d3.select(event.currentTarget);
		showTooltip(d, event);
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
		if (event.target === svgNode || (zoomLayer && event.target === zoomLayer.node()) || event.target.classList.contains("zoom-layer")) {
			hideTooltipAndHighlights();
		}
	});
	d3.select("body").on("keydown", (event) => {
		if (event.key === "Escape") {
			hideTooltipAndHighlights();
		}
	});
}
