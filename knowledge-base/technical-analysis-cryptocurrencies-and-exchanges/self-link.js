class SelfLink extends HTMLHeadingElement {
	constructor() {
		super();

		let newElement = document.createElement('a');
		newElement.innerText = this.innerText || this.textContent;
		let slug = newElement.innerText.replace(/[^a-z0-9]/gi, _ => "-").replace(/(---*)+/gi, _ => "-");
		newElement.id = slug;
		newElement.href = '#' + slug;
		newElement.classList.add("self-link");

		const shadow = this.attachShadow({ mode: 'open' });
		shadow.appendChild(newElement);
	}
}

customElements.define('self-link', SelfLink, { extends: 'h1' });
console.log('self-link is loaded!')