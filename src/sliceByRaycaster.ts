import * as THREE from "three";

function flipVerticalAxis(currentAxis: "y" | "z"): "y" | "z" {
	return currentAxis === "y" ? "z" : "y";
}

function generateGCode(
	pointGatherer: THREE.Vector3[][],
	verticalAxis: "y" | "z" = "y",
): string {
	let gcode = "G21 ; Set units to millimeters\n";
	gcode += "G90 ; Use absolute positioning\n";
	gcode += "G1 Z5 F5000 ; Lift\n";

	for (const pointLevel of pointGatherer) {
		for (const point of pointLevel) {
			const flipHeight = flipVerticalAxis(verticalAxis);
			gcode += `G1 X${point.x.toFixed(2)} Y${point[flipHeight].toFixed(2)} Z${point[verticalAxis].toFixed(2)} F1500\n`;
		}
	}

	gcode += "G1 Z5 F5000 ; Lift\n";
	gcode += "M30 ; End of program\n";

	return gcode;
}

function downloadGCode(gcode: string, filename = "output.gcode") {
	const blob = new Blob([gcode], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function sliceByLightsaber(
	model: THREE.Mesh,
	verticalAxis: "y" | "z" = "y",
	layerHeight = 1,
	segments = 100,
	incrementHeight = true,
	debug = false,
) {
	const boundingBox = new THREE.Box3().setFromObject(model);
	const center = boundingBox.getCenter(new THREE.Vector3());
	const pointGatherer: THREE.Vector3[][] = [];
	const angleIncrement = (Math.PI * 2) / segments;

	for (
		let heightPosition = boundingBox.min[verticalAxis];
		heightPosition < boundingBox.max[verticalAxis];
		heightPosition += layerHeight
	) {
		const pointLevel = [];

		for (let angle = 0; angle < Math.PI * 2; angle += angleIncrement) {
			const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
			const adjustedHeight = incrementHeight
				? heightPosition + (angle / (Math.PI * 2)) * layerHeight
				: heightPosition;
			const raycaster = new THREE.Raycaster(
				new THREE.Vector3(center.x, adjustedHeight, center.z),
				direction,
			);
			const intersects = raycaster.intersectObject(model);

			if (intersects.length > 0) {
				// TODO: compare the intersection point with the one right below it to compare hard angles.
				const intersection = intersects[0].point;
				pointLevel.push(intersection);

				const lastPointAccess = pointLevel.length - 1;
				const lastLevelAccess = pointGatherer.length - 1;

				const pointOneLevelDown =
					pointGatherer[lastLevelAccess]?.[lastPointAccess];
				const lastInsertedPoint = pointLevel[lastPointAccess];

				const oneLevelDownDistanceFromZero = pointOneLevelDown?.distanceTo(
					new THREE.Vector3(pointOneLevelDown.x, pointOneLevelDown.y, 0),
				);
				const lastInsertedDistanceFromZero = lastInsertedPoint.distanceTo(
					new THREE.Vector3(lastInsertedPoint.x, lastInsertedPoint.y, 0),
				);

				if (
					Math.abs(
						oneLevelDownDistanceFromZero - lastInsertedDistanceFromZero,
					) > 1
				) {
					console.log({
						oneLevelDownDistanceFromZero,
						lastInsertedDistanceFromZero,
					});
				}
			}
		}

		pointGatherer.push(pointLevel);
	}

	if (debug) {
		// NOTE: For debugging purposes without gcode generation.
		for (const pointlevel of pointGatherer) {
			for (const point of pointlevel) {
				const sphere = new THREE.Mesh(
					new THREE.SphereGeometry(0.1),
					new THREE.MeshBasicMaterial({ color: 0x0000ff }),
				);
				sphere.position.copy(point);

				model.parent?.add(sphere);
			}
		}
	}

	const gcode = generateGCode(pointGatherer, verticalAxis);
	downloadGCode(gcode);
}

export { sliceByLightsaber as sliceByRaycaster };
