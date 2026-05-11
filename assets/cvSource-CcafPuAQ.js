import{a as e,c as t,f as n,i as r,l as i,s as a,t as o}from"./loadSingle-BJWscsft.js";var s=Object.assign({"/content/figures/2d-cover.png":`/astro-studio-as-portfolio/assets/2d-cover-CA4hFau6.png`,"/content/figures/cv/ZhuChenghao-photo.jpg":`/astro-studio-as-portfolio/assets/ZhuChenghao-photo-Bl_JOK8k.jpg`,"/content/figures/publications/O3_AGN/ceers_spec.png":`/astro-studio-as-portfolio/assets/ceers_spec-C8rW6_LK.png`,"/content/figures/publications/O3_AGN/cloudy_ew.png":`/astro-studio-as-portfolio/assets/cloudy_ew-DtZU1zEG.png`,"/content/figures/publications/O3_AGN/sed.png":`/astro-studio-as-portfolio/assets/sed-3xxicCWI.png`,"/content/figures/publications/O3_AGN/subaru_1_spec.png":`/astro-studio-as-portfolio/assets/subaru_1_spec-DRtB-aPN.png`,"/content/figures/publications/O3_AGN/subaru_2_spec.png":`/astro-studio-as-portfolio/assets/subaru_2_spec-C8RD_ZfU.png`});function c(e,t){return l(t)||t.startsWith(`/`)?t:s[n(`${e}/${t}`)]??null}function l(e){return/^[a-z][a-z\d+.-]*:\/\//i.test(e)}var u=`+++
[info]
name = "Chenghao Zhu"
tag = "Physics Ph.D candidate"
email = "zhuchenghaozero@gmail.com"
photo = "./figures/cv/ZhuChenghao-photo.jpg"
github = "https://github.com/YoRHazero"

[[education]]
institution = "Fudan University"
degree = "Bachelor's in Physics"
location = "Shanghai, China"
period = { start = "2018-09", end = "2022-07" }

[[education]]
institution = "The University of Tokyo"
degree = "Master's in Physics"
location = "Tokyo, Japan"
period = { start = "2022-10", end = "2024-09" }

[[education]]
institution = "The University of Tokyo"
degree = "Ph.D candidate in Physics"
location = "Tokyo, Japan"
description = "Expected completion in September 2027."
period = { start = "2024-10", end = "2027-09" }

[[skills]]
category = "Languages"
items = ["Python", "TypeScript", "Rust"]

[[skills]]
category = "Astronomy tooling"
items = ["JWST image retrieval", "JWST grism visualization", "spectral extraction", "emission-line analysis"]

[[skills]]
category = "Frontend / visualization"
items = ["React", "Three.js", "PixiJS", "Plotly", "Zustand", "TanStack"]

[[skills]]
category = "Backend / data"
items = ["FastAPI", "SQLModel", "PyMC", "pydantic", "Typer", "anyio"]

[[skills]]
category = "Systems"
items = ["Tokio", "GPUI", "rusqlite"]
+++

I am a Physics Ph.D candidate at The University of Tokyo, working at the intersection of astronomy data analysis and scientific software.

My projects focus on JWST workflows: retrieving and managing astronomical image data, visualizing grism observations, extracting spectra from selected sources, and building backend services for fitting and database operations.

I also build systems tools in Rust, including a clipboard history and LAN sharing application.
`,d=a({start:t(),end:t().nullable()}),f=a({institution:t(),degree:t(),period:d,location:t(),description:t().optional()}),p=a({institution:t(),title:t(),period:d,location:t(),description:t().optional()}),m=a({title:t(),date:t(),issuer:t().optional(),description:t().optional()}),h=a({name:t(),tag:t().trim().min(1).optional(),email:e(),photo:t(),github:i().optional(),linkedin:i().optional()}),g=a({category:t(),items:r(t())}),_=a({info:h,education:r(f),experience:r(p).optional(),awards:r(m).optional(),skills:r(g).optional()}),v=o(Object.assign({"/content/cv.md":u}),`/content/cv.md`,_);export{c as n,v as t};