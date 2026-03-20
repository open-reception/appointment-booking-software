# GlobaLeaks Contributing Guide

Hi! Thank you so much for being interested in contributing to OpenReception.

As a contributor, here are the guidelines we would like you to read:

- [Code of Conduct](#coc)
- [Got a Question or Problem?](#question)
- [Found a Bug?](#issue)
- [Do you have a Feature Idea?](#feature)
- [Contributing Guidelines](#submit)

## <a name="coc"></a> Code of Conduct

Help us keep OpenReception community safe and inclusive.
Please read and follow our [Code of Conduct](https://open-reception.org/community/code-of-conduct/).

## <a name="question"></a> Got a Question or Problem?

Do not open issues for general support questions as we want to keep GitHub issues for bug reports and feature requests.
Instead, we recommend using our Discussion Forum space to ask support-related questions.

## <a name="issue"></a> Found a Bug?

If you find a bug in the source code, you can help us by [Opening a Ticket](#submit-issue) to our Ticketing System.

Even better, you can [Submit a Pull Request](#submit-pr) with a fix.

## <a name="feature"></a> Do you have a Feature Idea?

You can suggest a new feature by [Opening a Ticket](#submit-issue) to our Ticketing System.
If you would like to implement a new feature, please consider the size of the change in order to determine the right steps to proceed:

- For a **Major Feature**, first open an issue and outline your proposal so that it can be discussed.
  This process allows us to better coordinate our efforts, prevent duplication of work, and help you to craft the change so that it is successfully accepted into the project.

- **Small Features** can be crafted and directly [Submitting a Pull Request](#submit-pr).

## <a name="submit"></a> Submission Guidelines

### <a name="submission-legal"></a> Legal implications

OpenReception maintainers have offered selected business partners a commercial license for the software. Developments made by these partners are not subject to the AGPL.

By contributing to the Open Source project, you agree that these commercial partners may also use and incorporate all enhancements and modifications made to the Open Source product under their commercial license.

### <a name="submit-issue"></a> Opening a Ticket

Before you open a ticket, please search through the [List of Tickets](https://github.com/open-reception/appointment-booking-software/issues). A ticket for your problem might already exist and the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug, we need to reproduce and confirm it.
In order to reproduce bugs, we require that you provide a minimal reproduction.
Having a minimal reproducible scenario gives us a wealth of important information without going back and forth to you with additional questions.

A minimal reproduction allows us to quickly confirm a bug (or point out a coding problem) as well as confirm that we are fixing the right problem.

We require a minimal reproduction to save maintainers' time and ultimately be able to fix more bugs.
Often, developers find coding problems themselves while preparing a minimal reproduction.
We understand that sometimes it might be hard to extract essential bits of code from a larger codebase, but we really need to isolate the problem before we can fix it.

Unfortunately, we are not able to investigate / fix bugs without a minimal reproduction, so if we your issue lacks this information, we are going to close it.

You can file new issues by selecting from our [new issue templates](https://github.com/open-reception/appointment-booking-software/issues/new/choose) and filling out the issue template.

### <a name="submit-pr"></a> Submitting a Pull Request

Before you submit your Pull Request consider the following guidelines:

1. Read and accept the [legal implications](#submission-legal).

1. Search on the [List of Pull Requests](https://github.com/open-reception/appointment-booking-software/pulls) for an open or closed pull requests that relates to your contribution.  
   You don't want to duplicate existing efforts.

1. Be sure that an issue describes the problem you're fixing, or documents the design for the feature you'd like to add.
   Discussing the design upfront helps to ensure that we're ready to accept your work.

1. Fork the `appointment-booking-software` repository.

1. In your forked repository, make your changes in dedicated git branch.

1. Create your patch, documenting your code and including appropriate test cases.

1. Follow standard coding guidelines for each specific language.

1. Run the full `appointment-booking-software` test suite and ensure that all tests pass.

1. Also run full formatting, linting, and type checking.

1. Commit your changes using a descriptive commit message.

1. In GitHub, send a pull request to `main` branch.

---

A big thank you to everyone who has already contributed to the development of OpenReception!

This contribution guide was largely inspired by the [GlobaLeaks Contribution Guide](https://www.globaleaks.org)
