import { Suspense, useEffect, type CSSProperties } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ACCENT, SECTIONS, site } from '../content'
import { loading } from '../loading'
import { switchMode } from '../mode'
import { FloatingProps } from './FloatingProps'
import { BASE_FOV, EYE_HEIGHT, SPAWN } from './layout'
import { preloadModels } from './models'
import { Objects } from './Objects'
import { Player } from './Player'
import { Room, Sky } from './Room'
import { game, resetGame } from './state'

// This file arrives on its own, after the page. Start fetching the models the moment it does.
preloadModels()

/**
 * Mounted together with everything that had to be downloaded, so it runs once all of it is in.
 * Compiles the shaders and lets two frames go by before saying so, so the first look is smooth.
 */
function SceneReady() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let live = true
    let frame = 0
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => live && loading.set({ ready: true }))
        })
      })
    return () => {
      live = false
      cancelAnimationFrame(frame)
    }
  }, [gl, scene, camera])
  return null
}

/** Text over the 3D view: who this is, how to move, and what the visitor is pointing at. */
function Hud() {
  const phase = game.use((s) => s.phase)
  const aimed = game.use((s) => s.aimed)
  const locked = game.use((s) => s.locked)
  const touched = game.use((s) => s.touched)

  return (
    <div className={`hud${phase === 'explore' ? '' : ' hud--hidden'}`}>
      <div className="hud__name">
        {site.name}
        <span>{site.tagline}</span>
      </div>
      <button className="hud__plain" onClick={() => switchMode('plain')}>
        {site.ui.enter_plain}
      </button>
      {locked && <i className={`crosshair${aimed ? ' crosshair--on' : ''}`} aria-hidden="true" />}
      <p className="hud__prompt">
        {/* Keep labels mounted so leaving a target fades its name out, too. */}
        {([...SECTIONS, 'switch'] as const).map((id) => (
          <span
            key={id}
            className={`hud__destination${aimed === id ? ' hud__destination--on' : ''}`}
            style={{ '--accent': id === 'switch' ? '#dfe9ff' : ACCENT[id] } as CSSProperties}
            aria-hidden={aimed !== id}
          >
            {id === 'switch' ? site.ui.enter_plain : site.sections[id].label}
          </span>
        ))}
      </p>
      <p className="hud__hint">
        {!touched && !locked && <b>{site.ui.hint_start}</b>}
        {site.ui.hint_controls}
      </p>
    </div>
  )
}

export default function Game() {
  const phase = game.use((s) => s.phase)
  useEffect(() => resetGame, [])

  return (
    <div className="game">
      <Canvas
        // Nothing moves behind a page, so stop drawing until the visitor comes back.
        frameloop={phase === 'page' ? 'never' : 'always'}
        dpr={[1, 2]}
        shadows
        camera={{ fov: BASE_FOV, near: 0.05, far: 1500, position: [SPAWN.x, EYE_HEIGHT, SPAWN.z] }}
      >
        <color attach="background" args={['#020308']} />
        <Suspense fallback={null}>
          <Sky />
          <Room>
            <Objects />
            <FloatingProps />
          </Room>
          <SceneReady />
        </Suspense>
        <Player />
      </Canvas>
      <Hud />
    </div>
  )
}
