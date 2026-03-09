import { NODE_TYPE_PERSON, NODE_TYPE_GAME } from "./config.js";

export function setupD3Tooltips(nodeSelection, tooltipElement, personRolesMap, svgNode, gameNodes = []) {
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
	const gameNameById = new Map((gameNodes ?? []).map((node) => [node.id, node.name]));

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

	const showTooltip = (nodeData, event) => {
		const clientX = event.clientX;
		const clientY = event.clientY;

		let htmlContent = `<div class="tooltip-card"><div class="tooltip-header"><strong>${escapeHtml(nodeData.name || "Unknown Node")}</strong>`;
		if (nodeData.type && nodeData.type !== NODE_TYPE_PERSON) {
			htmlContent += `<span class="tooltip-kind">${escapeHtml(nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1))}</span>`;
		}
		htmlContent += "</div>";

		if (nodeData.type === NODE_TYPE_PERSON) {
			const contributionCount = nodeData.contributionCount ?? nodeData.gameIds?.length ?? 0;
			if (contributionCount > 0) {
				htmlContent += `<div class="tooltip-meta">Contributed to ${escapeHtml(contributionCount)} selected game${contributionCount === 1 ? "" : "s"}</div>`;
			}

			const roleDetails = personRolesMap.get(nodeData.id);
			if (Array.isArray(roleDetails?.games) && roleDetails.games.length > 0) {
				roleDetails.games.forEach((gameEntry) => {
					const label = gameEntry.gameName || gameNameById.get(gameEntry.gameId) || "Game";
					htmlContent += formatRoleSection(label, gameEntry.roles, "game");
				});
			} else if (roleDetails?.allRoles?.size > 0) {
				htmlContent += formatRoleSection("Roles", roleDetails.allRoles);
			} else if (nodeData.primaryRole) {
				htmlContent += `<div class="tooltip-meta">Primary role: ${escapeHtml(nodeData.primaryRole)}</div>`;
			}
		} else if (nodeData.type === NODE_TYPE_GAME) {
			const contributorCount = nodeData.degree || 0;
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

	nodeSelection.on("mouseenter", (event, nodeData) => {
		const currentTargetNode = d3.select(event.currentTarget);
		showTooltip(nodeData, event);
		currentTargetNode.classed("tooltip-active", true);
	});

	nodeSelection.on("mouseleave", () => {
		hideTooltipOnly();
	});

	nodeSelection.on("click", (event, nodeData) => {
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
		if (nodeData.type !== NODE_TYPE_PERSON) {
			return;
		}

		const clickedRoles = personRolesMap.get(nodeData.id)?.allRoles;
		currentTargetNode.classed("highlighted-department", true);
		if (clickedRoles && clickedRoles.size > 0) {
			nodeSelection
				.filter((otherNode) => {
					if (otherNode.type !== NODE_TYPE_PERSON || otherNode.id === nodeData.id) return false;
					const otherRoles = personRolesMap.get(otherNode.id)?.allRoles;
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
