import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table';

describe('Table mobile card labeling', () => {
  it('stamps data-label from header text onto body cells', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button>
                Customer <svg />
              </button>
            </TableHead>
            <TableHead>Amount</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Acme</TableCell>
            <TableCell>1250</TableCell>
            <TableCell>actions</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(html).toContain('data-label="Customer"');
    expect(html).toContain('data-label="Amount"');
    // Empty header -> no label on the actions cell
    expect(html).not.toContain('data-label=""');
    expect(html).toContain('responsive-cards');
  });

  it('labels cells inside raw <tr> wrappers (RowContextMenu pattern)', () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <tr>{children}</tr>
    );
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Wrapper>
            <TableCell>Widget</TableCell>
            <TableCell>Active</TableCell>
          </Wrapper>
        </TableBody>
      </Table>
    );
    expect(html).toContain('data-label="Name"');
    expect(html).toContain('data-label="Status"');
  });

  it('skips colSpan cells and honors conditional columns', () => {
    const showExtra = false;
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showExtra && <TableHead>Extra</TableHead>}
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
            {showExtra && <TableCell>x</TableCell>}
            <TableCell>10</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={2}>No results</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(html).toContain('data-label="Name"');
    expect(html).toContain('data-label="Total"');
    expect(html).not.toContain('data-label="Extra"');
    expect(html.match(/data-label=/g)?.length).toBe(2);
  });

  it('mobileCards={false} opts out entirely', () => {
    const html = renderToStaticMarkup(
      <Table mobileCards={false}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(html).not.toContain('data-label');
    expect(html).not.toContain('responsive-cards');
  });
});
