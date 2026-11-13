+++
name = "JWST data analysis platform"
summary = "Visual inspection and Bayesian modelling of JWST slitless spectroscopy."
repos = ["YoRHazero/noobrowser", "YoRHazero/noobackend", "YoRHazero/jwstnoobfriend", "YoRHazero/noobase"]
tags = ["Three.js", "PixiJS", "FastAPI", "NumPyro", "JAX", "PyO3"]
order = 1
+++

A set of tools for inspecting JWST wide-field slitless spectroscopy (WFSS) data. **noobrowser** is the web app, which draws images and spectra with WebGL. It talks to **noobackend**, a FastAPI service built on **jwstnoobfriend**, the Python library underneath. **noobase** collects basic spectroscopy and photometry routines in Rust.

Model fitting runs as Bayesian MCMC pipelines, from the raw data to posterior diagnostics.
