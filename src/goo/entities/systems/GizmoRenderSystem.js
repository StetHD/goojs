define([
	'goo/entities/systems/System',
	'goo/entities/SystemBus',
	'goo/renderer/SimplePartitioner',
	'goo/renderer/Material',
	'goo/renderer/shaders/ShaderLib',
	'goo/renderer/Util',
	'goo/math/Matrix3x3',
	'goo/math/Matrix4x4',
	'goo/util/gizmos/Gizmo',
	'goo/util/gizmos/TranslationGizmo',
	'goo/util/gizmos/RotationGizmo',
	'goo/util/gizmos/ScaleGizmo'
],
/** @lends */
function (
	System,
	SystemBus,
	SimplePartitioner,
	Material,
	ShaderLib,
	Util,
	Matrix3x3,
	Matrix4x4,
	Gizmo,
	TranslationGizmo,
	RotationGizmo,
	ScaleGizmo
) {
	"use strict";

	/**
	 * @class Renders entities/renderables using a configurable partitioner for culling
	 * @property {Boolean} doRender Only render if set to true
	 */
	function GizmoRenderSystem(callbacks) {
		System.call(this, 'GizmoRenderSystem', null);

		this.renderables = [];
		this.camera = null;

		this.gizmos = [
			new TranslationGizmo(),
			new RotationGizmo(),
			new ScaleGizmo()
		];
		this.setupCallbacks(callbacks);
		this.boundEntity = null;
		this.activeGizmo = null;
		this.viewportWidth = 0;
		this.viewportHeight = 0;
		this.domElement = null;
		this.global = false;

		this.mouseMove = function(evt) {
			if(!this.activeGizmo) {
				return;
			}
			this.activeGizmo.update([
				evt.offsetX / this.viewportWidth,
				evt.offsetY / this.viewportHeight
			]);
		}.bind(this);


		var that = this;
		SystemBus.addListener('goo.setCurrentCamera', function (camera) {
			that.camera = camera;
		});
	}

	GizmoRenderSystem.prototype = Object.create(System.prototype);

	GizmoRenderSystem.prototype.activate = function(id, x, y) {
		var handle = Gizmo.getHandle(id);
		if (handle && this.activeGizmo) {
			this.activeGizmo.activate({
				data: handle,
				x: x / this.viewportWidth,
				y: y / this.viewportHeight
			});
			this.domElement.addEventListener('mousemove', this.mouseMove);
		}
	};

	GizmoRenderSystem.prototype.deactivate = function() {
		this.domElement.removeEventListener('mousemove', this.mouseMove);
	};

	GizmoRenderSystem.prototype.getGizmo = function(id) {
		return this.gizmos[id];
	}

	GizmoRenderSystem.prototype.show = function(entity) {
		this.entity = entity;
		if (this.activeGizmo) {
			if (this.entity) {
				this.showGizmo(this.activeGizmo);
			} else {
				this.hideGizmo(this.activeGizmo);
			}
		}
	};

	GizmoRenderSystem.prototype.showGizmo = function(gizmo) {
		gizmo.copyTransform(this.entity.transformComponent.worldTransform, this.global);
		if (!gizmo.visible) {
			this.renderables = gizmo.renderables;
			gizmo.visible = true;
		}
	};

	GizmoRenderSystem.prototype.hideGizmo = function(gizmo) {
		if (gizmo.visible) {
			this.renderables = [];
			gizmo.visible = false;
		}
	};

	GizmoRenderSystem.prototype.setActiveGizmo = function(id) {
		if (this.activeGizmo) {
			this.hideGizmo(this.activeGizmo);
		}
		this.activeGizmo = this.gizmos[id] || null;
		if (this.activeGizmo && this.entity) {
			this.showGizmo(this.activeGizmo);
		}
	};
	GizmoRenderSystem.prototype.setGlobal = function(global) {
		if(this.global !== global) {
			this.global = !!global;
			if(this.entity && this.activeGizmo) {
				this.showGizmo(this.activeGizmo);
			}
		}
	};

	GizmoRenderSystem.prototype.setupCallbacks = function(callbacks) {
		if(callbacks && callbacks.length === 3) {
			this.gizmos[0].onChange = callbacks[0];
			this.gizmos[1].onChange = callbacks[1];
			this.gizmos[2].onChange = callbacks[2];
			return;
		}

		var inverseRotation = new Matrix3x3();
		var inverseTransformation = new Matrix4x4();

		// Set bound entities translation
		this.gizmos[0].onChange = function(change) {
			if (this.entity) {
				var translation = this.entity.transformComponent.transform.translation;
				translation.setv(change);
				if (this.entity.transformComponent.parent) {
					inverseTransformation.copy(this.entity.transformComponent.parent.worldTransform.matrix);
					inverseTransformation.invert();
					inverseTransformation.applyPostPoint(translation);
				}
				this.entity.transformComponent.setUpdated();
			}
		}.bind(this);

		// Set bound entities rotation
		this.gizmos[1].onChange = function(change) {
			if (this.entity) {
				this.entity.transformComponent.transform.rotation.copy(change);
				if (this.entity.transformComponent.parent) {
					inverseRotation.copy(this.entity.transformComponent.parent.worldTransform.rotation);
					inverseRotation.invert();
				}
				Matrix3x3.combine(
					inverseRotation,
					this.entity.transformComponent.transform.rotation,
					this.entity.transformComponent.transform.rotation
				);
				this.entity.transformComponent.setUpdated();
			}
		}.bind(this);

		// Set bound entities scale
		this.gizmos[2].onChange = function(change) {
			if (this.entity) {
				var scale = this.entity.transformComponent.transform.scale;
				scale.setv(change);
				if (this.entity.transformComponent.parent) {
					scale.div(this.entity.transformComponent.parent.worldTransform.scale);
				}
				this.entity.transformComponent.setUpdated();
			}
		}.bind(this);
	};

	GizmoRenderSystem.prototype.inserted = function (/*entity*/) {};

	GizmoRenderSystem.prototype.deleted = function (/*entity*/) {};

	GizmoRenderSystem.prototype.process = function (/*entities, tpf*/) {
		if (this.activeGizmo) {
			if (this.activeGizmo.dirty) {
				this.activeGizmo.process();
			} else if (this.entity && this.entity.transformComponent._updated) {
				this.activeGizmo.copyTransform(this.entity.transformComponent.worldTransform, this.global);
			}
			this.activeGizmo.updateTransforms();
		}

	};

	GizmoRenderSystem.prototype.render = function (renderer) {
		renderer.checkResize(this.camera);

		if(!this.domElement) {
			this.domElement = renderer.domElement;
		}
		this.viewportHeight = renderer.viewportHeight;
		this.viewportWidth = renderer.viewportWidth;

		if (this.camera) {
			renderer.render(this.renderables, this.camera, this.lights, null, { color: false, stencil: true, depth: true }, this.overrideMaterials);
		}
	};

	GizmoRenderSystem.prototype.renderToPick = function(renderer, skipUpdateBuffer) {
				renderer.renderToPick(this.renderables, this.camera, { color: false, stencil: true, depth: true }, skipUpdateBuffer);
	};

	return GizmoRenderSystem;
});