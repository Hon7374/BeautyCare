# Open-Source DBMS Security Survey

This document supports the theory section in the proposal: security characteristics of MySQL, MariaDB, and PostgreSQL.

## Scope

- theory purpose: summarize security controls in common open-source relational DBMSs
- experiment purpose: compare that theory with the prototype implementation
- repository implementation: MySQL is used for the practical prototype

## MySQL

- role/privilege based access control
- TLS support for client-server connections
- audit plugins and password policy support
- common risks: over-privileged accounts, weak passwords, exposed remote access, injection from the app layer

## MariaDB

- similar security model to MySQL
- supports roles, privileges, TLS, audit ecosystem plugins
- practical for low-cost, flexible deployments
- still requires least-privilege design and patch management

## PostgreSQL

- strong role and schema privilege model
- row-level security support
- TLS support and mature extension ecosystem
- good fit for systems needing tighter data integrity and access segmentation

## Cross-DB Security Controls

- encrypt transport with TLS
- apply least privilege
- separate app accounts from admin accounts
- rotate credentials and keep audit logs
- use parameterized queries to reduce SQL injection risk

## Mapping To This Prototype

- theory: MySQL, MariaDB, PostgreSQL
- experiment: MySQL is used here to validate auth, payment, CRM, loyalty, audit, and discount features in a working prototype
