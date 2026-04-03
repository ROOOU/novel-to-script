import { SignUp } from '@clerk/nextjs';
import { describe, expect, it } from 'vitest';
import { SignUpForm } from './SignUpForm';

describe('SignUpForm', () => {
  it('passes the requested redirect target to Clerk', () => {
    const page = SignUpForm({
      locale: 'en-US',
      redirectUrl: 'https://app.012294.xyz/en-US/pricing',
    });

    expect(page.type).toBe('div');
    expect(page.props.children.type).toBe('div');
    expect(page.props.children.props.children.type).toBe(SignUp);
    expect(page.props.children.props.children.props).toMatchObject({
      routing: 'path',
      path: '/sign-up',
      signInUrl: '/en-US/login',
      fallbackRedirectUrl: 'https://app.012294.xyz/en-US/pricing',
    });
  });
});
