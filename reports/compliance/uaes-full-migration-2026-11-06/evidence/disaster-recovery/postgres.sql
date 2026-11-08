--
-- PostgreSQL database dump
--

\restrict pldS62uOPW0SKMHEy53yYBdxjLVQQbtmihzwg6IPLuXwa2IQAtvc5nfQiNPLzDO

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dr_check; Type: TABLE; Schema: public; Owner: uter
--

CREATE TABLE public.dr_check (
    id integer NOT NULL,
    payload text,
    amount numeric(18,4)
);


ALTER TABLE public.dr_check OWNER TO uter;

--
-- Data for Name: dr_check; Type: TABLE DATA; Schema: public; Owner: uter
--

COPY public.dr_check (id, payload, amount) FROM stdin;
1	alpha	10.0001
2	beta	20.5000
3	gamma	30.9999
\.


--
-- Name: dr_check dr_check_pkey; Type: CONSTRAINT; Schema: public; Owner: uter
--

ALTER TABLE ONLY public.dr_check
    ADD CONSTRAINT dr_check_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict pldS62uOPW0SKMHEy53yYBdxjLVQQbtmihzwg6IPLuXwa2IQAtvc5nfQiNPLzDO

