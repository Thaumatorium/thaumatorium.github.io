import { NODE_TYPE_PERSON, NODE_TYPE_GAME, CATEGORY_GAME1_ONLY, CATEGORY_GAME2_ONLY, CATEGORY_BOTH } from "./config.js";

/**
 * Sets up event listeners on D3 nodes.
 * Uses absolute positioning relative to the SVG container's coordinate space.
 * Positions tooltip primarily to the upper-right of the cursor.
 * Assumes the SVG container or an ancestor has position: relative.
 *
 * @param {d3.Selection} nodeSelection - The D3 selection of node 'g' elements.
 * @param {HTMLElement} tooltipElement - The DOM element to use for the tooltip.
 * @param {Map<string, object>} personRolesMap - Map of person ID to their role details.
 * @param {SVGSVGElement} svgNode - The root SVG DOM element (for coordinate calculations).
 * @param {string | null} game1Name - The name of the first game being displayed.
 * @param {string | null} game2Name - The name of the second game (might be same as game1Name).
 * @param {boolean} isSingleGameView - Flag indicating if only one distinct game is shown.
 */
export function setupD3Tooltips(nodeSelection, tooltipElement, personRolesMap, svgNode, game1Name, game2Name, isSingleGameView) {
	if (!nodeSelection || !tooltipElement || !personRolesMap || !svgNode) return;

	const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	const formatListItems = (roles) =>
		[...roles]
			.sort()
			.map((role) => `<li>${escapeHtml(role)}</li>`)
			.join("");
	const formatRoleSection = (label, roles, tone = "") => {
		if (!roles || roles.size === 0) return "";
		const toneClass = tone ? ` tooltip-section-${tone}` : "";
		return `<section class="tooltip-section${toneClass}"><div class="tooltip-section-label">${escapeHtml(label)}</div><ul class="tooltip-list">${formatListItems(roles)}</ul></section>`;
	};

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
		const clientX = event.clientX;
		const clientY = event.clientY;

		let htmlContent = `<div class="tooltip-card"><div class="tooltip-header"><strong>${escapeHtml(d.name || "Unknown Node")}</strong>`;
		if (d.type && d.type !== NODE_TYPE_PERSON) {
			htmlContent += `<span class="tooltip-kind">${escapeHtml(d.type.charAt(0).toUpperCase() + d.type.slice(1))}</span>`;
		}
		htmlContent += "</div>";

		if (d.type === NODE_TYPE_PERSON) {
			let contributionText = "";
			if (isSingleGameView) {
				if (game1Name) contributionText = `Contributed to: ${game1Name}`;
			} else {
				switch (d.category) {
					case CATEGORY_GAME1_ONLY:
						contributionText = `Contributed to: ${game1Name}`;
						break;
					case CATEGORY_GAME2_ONLY:
						contributionText = `Contributed to: ${game2Name}`;
						break;
					case CATEGORY_BOTH:
						contributionText = "Contributed to: both";
						break;
					default:
						contributionText = `Contribution status: ${d.category || "Unknown"}`;
						break;
				}
			}
			if (contributionText) {
				htmlContent += `<div class="tooltip-meta">${escapeHtml(contributionText)}</div>`;
			}

			const roleDetails = personRolesMap.get(d.id);
			if (roleDetails?.allRoles?.size > 0) {
				if (isSingleGameView) {
					htmlContent += formatRoleSection("Roles", roleDetails.allRoles);
				} else {
					htmlContent += formatRoleSection(game1Name, roleDetails.game1OnlyRoles, "game1");
					htmlContent += formatRoleSection("Shared", roleDetails.sharedRoles, "shared");
					htmlContent += formatRoleSection(game2Name, roleDetails.game2OnlyRoles, "game2");
					if (roleDetails.sharedRoles.size === 0 && roleDetails.game1OnlyRoles.size === 0 && roleDetails.game2OnlyRoles.size === 0) {
						htmlContent += formatRoleSection("Roles", roleDetails.allRoles);
					}
				}
			} else if (d.primaryRole) {
				htmlContent += `<div class="tooltip-meta">Primary role: ${escapeHtml(d.primaryRole)}</div>`;
			}
		} else if (d.type === NODE_TYPE_GAME) {
			const contributorCount = d.degree || 0;
			htmlContent += `<div class="tooltip-meta">Contributors shown: ${escapeHtml(contributorCount)}</div>`;
		}

		htmlContent += "</div>";

		tooltipElement.innerHTML = htmlContent;
		tooltipElement.style.display = "block";
		tooltipElement.setAttribute("aria-hidden", "false");
		tooltipElement.style.left = "-10000px";
		tooltipElement.style.top = "-10000px";
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const tooltipWidth = tooltipRect.width;
		const tooltipHeight = tooltipRect.height;
		const tooltipPadding = 15;

		const contextRect = positioningContextElement.getBoundingClientRect();
		const mouseXRelative = clientX - contextRect.left;
		const mouseYRelative = clientY - contextRect.top;

		let targetContextLeft = mouseXRelative + tooltipPadding;
		let targetContextTop = mouseYRelative - tooltipHeight - tooltipPadding;

		const contextWidth = positioningContextElement.offsetWidth;
		const contextHeight = positioningContextElement.offsetHeight;
		const boundaryPadding = 10;

		if (targetContextTop < boundaryPadding) {
			targetContextTop = mouseYRelative + tooltipPadding;
		}
		if (targetContextLeft + tooltipWidth > contextWidth - boundaryPadding) {
			targetContextLeft = mouseXRelative - tooltipWidth - tooltipPadding;
		}
		if (targetContextLeft < boundaryPadding) {
			targetContextLeft = boundaryPadding;
		}
		if (targetContextTop + tooltipHeight > contextHeight - boundaryPadding) {
			targetContextTop = contextHeight - tooltipHeight - boundaryPadding;
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
	nodeSelection.on("mouseleave", () => {
		hideTooltipOnly();
	});
	nodeSelection.on("click", (event, d) => {
		event.stopPropagation();

		const isCtrlClick = event.ctrlKey || event.metaKey;
		if (!isCtrlClick) return;

		const currentTargetNode = d3.select(event.currentTarget);
		hideTooltipOnly();
		const wasAlreadyHighlighted = currentTargetNode.classed("highlighted-department");
		const wasHighlightActive = nodesGroup ? nodesGroup.classed("department-highlight-active") : false;

		clearHighlights();

		if (wasAlreadyHighlighted && wasHighlightActive) {
			return;
		}
		if (d.type !== NODE_TYPE_PERSON) {
			return;
		}

		const clickedRoles = personRolesMap.get(d.id)?.allRoles;
		currentTargetNode.classed("highlighted-department", true);
		if (clickedRoles && clickedRoles.size > 0) {
			nodeSelection
				.filter((_d) => {
					if (_d.type !== NODE_TYPE_PERSON || _d.id === d.id) return false;
					const otherRoles = personRolesMap.get(_d.id)?.allRoles;
					if (!otherRoles || otherRoles.size === 0) return false;
					return [...clickedRoles].some((role) => otherRoles.has(role));
				})
				.classed("highlighted-department", true);
		}
		if (nodesGroup) {
			nodesGroup.classed("department-highlight-active", true);
		}
	});
	d3.select(svgNode).on("click", (event) => {
		if (event.target === svgNode || (zoomLayer && event.target === zoomLayer.node()) || event.target.classList.contains("zoom-layer")) {
			hideTooltipAndHighlights();
		}
	});
	d3.select("body").on("keydown.tooltip", (event) => {
		if (event.key === "Escape") {
			hideTooltipAndHighlights();
		}
	});
}
