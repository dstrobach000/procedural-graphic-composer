import { OrthographicCamera, Scene } from 'three';

export type SceneRoot = {
  scene: Scene;
  camera: OrthographicCamera;
};

export function createSceneRoot(width = 1, height = 1): SceneRoot {
  const scene = new Scene();
  const camera = new OrthographicCamera();
  camera.near = -1000;
  camera.far = 1000;
  camera.position.z = 1;
  setSceneRootSize(camera, width, height);
  return { scene, camera };
}

export function setSceneRootSize(camera: OrthographicCamera, width: number, height: number): void {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  camera.left = -safeWidth / 2;
  camera.right = safeWidth / 2;
  camera.top = safeHeight / 2;
  camera.bottom = -safeHeight / 2;
  camera.updateProjectionMatrix();
}
