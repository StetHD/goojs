define(['goo/entities/EventHandler'],
	/** @lends LightManager */
	function (EventHandler) {
	"use strict";

	/**
	 * @class Keeps track of all current lights in the world.
	 */
	function LightManager() {
		this.type = 'LightManager';

		this.lights = [];
	}

	LightManager.prototype.addedComponent = function (entity, component) {
		if (component.type !== 'LightComponent') {
			return;
		}

		if (this.lights.indexOf(component.light) === -1) {
			this.lights.push(component.light);
			EventHandler.dispatch("setLights", this.lights);
		}
	};

	LightManager.prototype.removedComponent = function (entity, component) {
		if (component.type !== 'LightComponent') {
			return;
		}

		var index = this.lights.indexOf(component.light);
		if (index !== -1) {
			this.lights.splice(index, 1);
			EventHandler.dispatch("setLights", this.lights);
		}
	};

	return LightManager;
});